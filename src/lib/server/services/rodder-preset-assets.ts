import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { error } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { env } from '$env/dynamic/private'
import type { BodyPreset, RodderPreset, PresetMediaAsset } from '$lib/rodder/presets.js'
import { SURFACE_RECIPE_VERSION } from '$lib/rodder/surface-model.js'
import { media } from '$lib/server/db/schema.js'
import { db } from '$lib/server/db/index.js'

type Dbx = Pick<typeof db, 'insert' | 'select'>
type SurfaceChannel = keyof NonNullable<BodyPreset['seedSurface']>['maps']

type PreparedAsset = {
	definition: PresetMediaAsset
	filepath: string
}

export type PreparedPresetSurface = {
	assets: Partial<Record<SurfaceChannel, PreparedAsset>>
}

const UPLOAD_DIR = env.UPLOAD_DIR || './uploads'
const STATIC_ROOTS = [
	path.resolve(process.cwd(), 'static'),
	path.resolve(process.cwd(), 'build', 'client'),
]

function sha256(buffer: Buffer): string {
	return createHash('sha256').update(buffer).digest('hex')
}

function inside(root: string, candidatePath: string): boolean {
	const child = path.relative(root, candidatePath)
	return child !== '' && !child.startsWith('..') && !path.isAbsolute(child)
}

async function readPublicAsset(asset: PresetMediaAsset): Promise<Buffer> {
	if (path.isAbsolute(asset.publicPath) || asset.publicPath.split(/[/\\]/).includes('..')) {
		throw error(500, `Unsafe preset asset path: ${asset.publicPath}`)
	}
	for (const root of STATIC_ROOTS) {
		const candidate = path.resolve(root, asset.publicPath)
		if (!inside(root, candidate)) continue
		try {
			return await readFile(candidate)
		} catch {
			// Try the adapter-node client output after the source static tree.
		}
	}
	throw error(500, `Preset asset is missing: ${asset.publicPath}. Run bun run seed:assets:mars.`)
}

async function prepareAsset(asset: PresetMediaAsset): Promise<PreparedAsset> {
	if (path.basename(asset.filename) !== asset.filename) throw error(500, `Unsafe preset media filename: ${asset.filename}`)
	const buffer = await readPublicAsset(asset)
	const actualHash = sha256(buffer)
	if (actualHash !== asset.contentHash || buffer.length !== asset.sizeBytes) {
		throw error(500, `Preset asset failed integrity validation: ${asset.publicPath}`)
	}

	const uploadRoot = path.resolve(UPLOAD_DIR)
	const filepath = path.resolve(uploadRoot, asset.filename)
	if (!inside(uploadRoot, filepath)) throw error(500, `Unsafe preset media destination: ${asset.filename}`)
	await mkdir(uploadRoot, { recursive: true })
	try {
		const current = await readFile(filepath)
		if (sha256(current) !== asset.contentHash) {
			throw error(409, `A different upload already uses the Mars seed filename ${asset.filename}.`)
		}
	} catch (error_) {
		if (error_ && typeof error_ === 'object' && 'status' in error_) throw error_
		await writeFile(filepath, buffer)
	}
	return { definition: asset, filepath }
}

/**
 * Verify and copy bundled preset files before opening a database transaction.
 * A failed rodder transaction may leave an identical, unreferenced file in
 * uploads; it never leaves a half-created rodder hierarchy or media row.
 */
export async function prepareRodderPresetAssets(preset: RodderPreset): Promise<Map<BodyPreset, PreparedPresetSurface>> {
	const prepared = new Map<BodyPreset, PreparedPresetSurface>()
	const bodies = preset.stars.flatMap(star => star.bodies.flatMap(body => [body, ...(body.moons ?? [])]))
	await Promise.all(bodies.map(async (body) => {
		if (!body.seedSurface) return
		const entries = await Promise.all(Object.entries(body.seedSurface.maps).map(async ([channel, asset]) => {
			return [channel, await prepareAsset(asset)] as const
		}))
		prepared.set(body, { assets: Object.fromEntries(entries) })
	}))
	return prepared
}

async function ensureMediaRow(dbx: Dbx, prepared: PreparedAsset) {
	const asset = prepared.definition
	const [existing] = await dbx.select().from(media).where(eq(media.filename, asset.filename)).limit(1)
	if (existing) {
		if (existing.hash !== asset.contentHash) {
			throw error(409, `Media already contains different content named ${asset.filename}.`)
		}
		return existing
	}
	const [created] = await dbx.insert(media).values({
		filename: asset.filename,
		filepath: prepared.filepath,
		mimeType: asset.mimeType,
		width: asset.width,
		height: asset.height,
		sizeBytes: asset.sizeBytes,
		hash: asset.contentHash,
		description: asset.description,
		originalFilename: asset.filename,
		hasThumb150: false,
		hasThumb300: false,
		hasThumb600: false,
		hasRaster: false,
	}).returning()
	return created
}

/** Install immutable Media rows and compose the current surface recipe. */
export async function installPresetSurface(
	dbx: Dbx,
	body: BodyPreset,
	prepared: PreparedPresetSurface | undefined,
): Promise<Record<string, unknown>> {
	if (!body.seedSurface || !prepared) return body.extra ?? {}
	const maps: Record<string, unknown> = {}
	for (const [channel, asset] of Object.entries(prepared.assets)) {
		if (!asset) continue
		const row = await ensureMediaRow(dbx, asset)
		maps[channel] = {
			version: 1,
			mediaId: row.id,
			filename: row.filename,
			contentHash: asset.definition.contentHash,
			interpretation: asset.definition.interpretation,
		}
	}
	return Object.assign({}, body.extra, {
		surface: {
			version: SURFACE_RECIPE_VERSION,
			fallback: body.seedSurface.fallback,
			class: body.seedSurface.class,
			seed: body.seedSurface.seed,
			coverage: body.seedSurface.coverage,
			maps,
		},
	})
}
