import { error } from '@sveltejs/kit'
import { and, eq } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { media, mediaAssetBindings, mediaVersions } from '$lib/server/db/schema.js'
import { parseSurfaceRecipe, type SurfaceMapChannel } from '$lib/celestial/surface-model.js'
import { parseStellarSurfaceRecipe } from '$lib/celestial/stellar-surface-model.js'
import {
	assessMediaCompatibility,
	parseMediaAssetBinding,
	purposeLabel,
	type CelestialMediaPurpose,
	type MediaAssetBinding,
} from '$lib/media/asset-binding.js'

type Dbx = Pick<typeof db, 'delete' | 'insert' | 'select'>
type BindingRow = typeof mediaAssetBindings.$inferInsert

const SURFACE_CHANNELS: SurfaceMapChannel[] = ['albedo', 'elevation', 'normal', 'roughness', 'emissive']

function recordValue(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? value as Record<string, unknown>
		: {}
}

async function resolveBinding(
	dbx: Dbx,
	raw: unknown,
	purpose: CelestialMediaPurpose,
): Promise<MediaAssetBinding | null> {
	const binding = parseMediaAssetBinding(raw, purpose)
	if (!binding) return null
	const [current] = binding.mediaId
		? await dbx.select().from(media).where(eq(media.id, binding.mediaId)).limit(1)
		: await dbx.select().from(media).where(eq(media.filename, binding.filename)).limit(1)
	if (!current) throw error(400, `The selected ${purposeLabel(purpose)} no longer exists in Media.`)
	if (!current.hash) throw error(400, `${current.filename} has no immutable content hash.`)

	const selectedHash = binding.contentHash ?? current.hash
	let revision: Pick<typeof current, 'mimeType' | 'width' | 'height' | 'hash'> | null = current.hash === selectedHash ? current : null
	if (!revision) {
		const [archived] = await dbx
			.select({ mimeType: mediaVersions.mimeType, width: mediaVersions.width, height: mediaVersions.height, hash: mediaVersions.hash })
			.from(mediaVersions)
			.where(and(eq(mediaVersions.filename, current.filename), eq(mediaVersions.hash, selectedHash)))
			.limit(1)
		revision = archived ?? null
	}
	if (!revision) throw error(400, `The pinned revision of ${current.filename} is no longer available.`)
	const compatibility = assessMediaCompatibility(revision)
	if (!compatibility.compatible) {
		throw error(400, `${current.filename} cannot be used as a ${purposeLabel(purpose)}: ${compatibility.errors.join('; ')}`)
	}

	return {
		...binding,
		mediaId: current.id,
		filename: current.filename,
		contentHash: selectedHash,
	}
}

export async function normalizeCelestialMediaBindings(
	dbx: Dbx,
	ownerId: number,
	kind: 'system' | 'star' | 'body',
	rawExtra: unknown,
): Promise<{ extra: Record<string, unknown>, rows: BindingRow[] } | null> {
	if (kind === 'system') return null
	const extra = { ...recordValue(rawExtra) }
	const rows: BindingRow[] = []

	if (kind === 'body') {
		const recipe = parseSurfaceRecipe(extra.surface)
		const maps: typeof recipe.maps = {}
		for (const channel of SURFACE_CHANNELS) {
			const purpose = `surface-${channel}` as CelestialMediaPurpose
			const binding = await resolveBinding(dbx, recipe.maps[channel], purpose)
			if (!binding) continue
			maps[channel] = binding
			rows.push({
				mediaId: binding.mediaId!, ownerType: 'celestial', ownerId,
				slot: `surface.${channel}`, contentHash: binding.contentHash!,
				filenameSnapshot: binding.filename, interpretation: binding.interpretation,
			})
		}
		extra.surface = { ...recipe, maps }
	} else {
		const recipe = parseStellarSurfaceRecipe(extra.stellarSurface)
		const binding = await resolveBinding(dbx, recipe.maps.photosphere, 'stellar-photosphere')
		extra.stellarSurface = { ...recipe, maps: binding ? { photosphere: binding } : {} }
		if (binding) {
			rows.push({
				mediaId: binding.mediaId!, ownerType: 'celestial', ownerId,
				slot: 'stellarSurface.photosphere', contentHash: binding.contentHash!,
				filenameSnapshot: binding.filename, interpretation: binding.interpretation,
			})
		}
	}
	return { extra, rows }
}

export async function replaceMediaBindingsForOwner(
	dbx: Dbx,
	ownerType: string,
	ownerId: number,
	rows: BindingRow[],
) {
	await dbx.delete(mediaAssetBindings).where(and(
		eq(mediaAssetBindings.ownerType, ownerType),
		eq(mediaAssetBindings.ownerId, ownerId),
	))
	if (rows.length > 0) await dbx.insert(mediaAssetBindings).values(rows)
}
