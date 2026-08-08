import { generateProceduralSurface, type GeneratedSurface, type ProceduralSurfaceParameters } from './procedural-surface.js'
import {
	generateProceduralStellarSurface,
	type GeneratedStellarSurface,
	type ProceduralStellarSurfaceParameters,
} from './procedural-stellar-surface.js'
import { PROCEDURAL_ALGORITHM_REVISION } from './procedural-profiles.js'
import type { ProceduralTextureRequest, ProceduralTextureResult } from './procedural-texture-worker.js'

export type ProceduralTextureSize = 256 | 512 | 1024
export type TexturePriority = 'background' | 'normal' | 'foreground'
export type ProceduralTextureOptions = { size: ProceduralTextureSize, priority: TexturePriority }

type Job = {
	id: number
	sequence: number
	priority: TexturePriority
	request: ProceduralTextureRequest
	resolve: (result: ProceduralTextureResult) => void
	reject: (error: Error) => void
}
type WorkerSlot = { worker: Worker, job: Job | null }
type CacheEntry = {
	promise: Promise<ProceduralTextureResult>
	estimateBytes: number
	bytes: number
	settled: boolean
}

export const MAX_PROCEDURAL_CACHE_BYTES = 64 * 1024 * 1024
const IDLE_WORKER_MS = 30_000
const PRIORITY: Record<TexturePriority, number> = { background: 0, normal: 1, foreground: 2 }
const queue: Job[] = []
const slots: WorkerSlot[] = []
const cache = new Map<string, CacheEntry>()
let nextId = 1
let sequence = 1
let cachedBytes = 0
let reservedBytes = 0
let idleTimer: ReturnType<typeof setTimeout> | null = null

export function compareTextureJobs(
	left: { priority: TexturePriority, sequence: number },
	right: { priority: TexturePriority, sequence: number },
): number {
	return PRIORITY[right.priority] - PRIORITY[left.priority] || left.sequence - right.sequence
}

const quantize = (value: number | null | undefined, precision: number): number | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null
	return Math.round(value / precision) * precision
}

function normalizePlanet(parameters: ProceduralSurfaceParameters) {
	return {
		class: parameters.class,
		seed: Math.trunc(parameters.seed),
		temperatureK: quantize(parameters.temperatureK, 0.1),
		coverage: {
			surfaceWater: quantize(parameters.coverage.surfaceWater, 0.001),
			vegetation: quantize(parameters.coverage.vegetation, 0.001),
			permanentSnowIce: quantize(parameters.coverage.permanentSnowIce, 0.001),
		},
		clouds: parameters.clouds ? {
			meanCover: quantize(parameters.clouds.meanCover, 0.001),
			seed: Math.trunc(parameters.clouds.seed),
		} : null,
		tint: parameters.tint?.map(channel => Math.round(channel)) ?? null,
	}
}

function normalizeStar(parameters: ProceduralStellarSurfaceParameters) {
	return {
		temperatureK: quantize(parameters.temperatureK, 0.1),
		morphology: parameters.morphology,
		rotationDays: quantize(parameters.rotationDays, 0.001),
		activity: quantize(parameters.activity, 0.001),
		seed: Math.trunc(parameters.seed),
	}
}

export function proceduralTextureCacheKey(
	kind: 'planet' | 'star',
	parameters: ProceduralSurfaceParameters | ProceduralStellarSurfaceParameters,
	size: ProceduralTextureSize,
): string {
	const normalized = kind === 'planet'
		? normalizePlanet(parameters as ProceduralSurfaceParameters)
		: normalizeStar(parameters as ProceduralStellarSurfaceParameters)
	return `${kind}:r${PROCEDURAL_ALGORITHM_REVISION}:${size}:${JSON.stringify(normalized)}`
}

function resultBytes(result: ProceduralTextureResult): number {
	if ('photosphere' in result) return result.photosphere.byteLength
	return result.albedo.byteLength + result.roughness.byteLength
		+ (result.elevation?.byteLength ?? 0) + (result.clouds?.byteLength ?? 0)
}

function estimateBytes(request: ProceduralTextureRequest): number {
	const pixels = request.width * request.height * 4
	if (request.kind === 'star') return pixels
	return pixels * (2 + Number(request.parameters.class !== 'gas') + Number((request.parameters.clouds?.meanCover ?? 0) > 0))
}

function generateSynchronously(request: ProceduralTextureRequest): ProceduralTextureResult {
	return request.kind === 'planet'
		? generateProceduralSurface(request.parameters, request.width, request.height)
		: generateProceduralStellarSurface(request.parameters, request.width, request.height)
}

function clearIdleTimer(): void {
	if (idleTimer) clearTimeout(idleTimer)
	idleTimer = null
}

function armIdleTimer(): void {
	clearIdleTimer()
	if (queue.length > 0 || slots.some(slot => slot.job)) return
	idleTimer = setTimeout(() => {
		if (queue.length > 0 || slots.some(slot => slot.job)) return
		for (const slot of slots) slot.worker.terminate()
		slots.length = 0
		idleTimer = null
	}, IDLE_WORKER_MS)
}

function dispatch(): void {
	queue.sort(compareTextureJobs)
	for (const slot of slots) {
		if (slot.job) continue
		const job = queue.shift()
		if (!job) break
		slot.job = job
		slot.worker.postMessage({ id: job.id, request: job.request })
	}
	armIdleTimer()
}

function finish(slot: WorkerSlot, result: ProceduralTextureResult | null, error: Error | null): void {
	const job = slot.job
	slot.job = null
	if (!job) return
	if (error) job.reject(error)
	else if (result) job.resolve(result)
	dispatch()
}

function ensureWorkers(): boolean {
	clearIdleTimer()
	if (slots.length > 0) return true
	if (typeof Worker === 'undefined') return false
	const hardwareConcurrency = globalThis.navigator?.hardwareConcurrency ?? 2
	const workerCount = Math.min(3, Math.max(1, hardwareConcurrency - 1))
	for (let index = 0; index < workerCount; index++) {
		const worker = new Worker(new URL('procedural-texture-worker.ts', import.meta.url), { type: 'module' })
		const slot: WorkerSlot = { worker, job: null }
		worker.addEventListener('message', (event: MessageEvent<{ id: number, result?: ProceduralTextureResult, error?: string }>) => {
			if (!slot.job || event.data.id !== slot.job.id) return
			finish(slot, event.data.result ?? null, event.data.error ? new Error(event.data.error) : null)
		})
		worker.addEventListener('error', () => {
			const failedJob = slot.job
			slot.job = null
			worker.terminate()
			const slotIndex = slots.indexOf(slot)
			if (slotIndex !== -1) slots.splice(slotIndex, 1)
			if (failedJob) {
				try {
					failedJob.resolve(generateSynchronously(failedJob.request))
				} catch (error) {
					failedJob.reject(error instanceof Error ? error : new Error('Procedural texture generation failed'))
				}
			}
			if (ensureWorkers()) {
				dispatch()
			} else {
				for (const queued of queue.splice(0)) {
					try {
						queued.resolve(generateSynchronously(queued.request))
					} catch (error) {
						queued.reject(error instanceof Error ? error : new Error('Procedural texture generation failed'))
					}
				}
			}
		})
		slots.push(slot)
	}
	return true
}

function enqueue(request: ProceduralTextureRequest, priority: TexturePriority): Promise<ProceduralTextureResult> {
	if (!ensureWorkers()) return Promise.resolve(generateSynchronously(request))
	return new Promise((resolve, reject) => {
		queue.push({ id: nextId++, sequence: sequence++, priority, request, resolve, reject })
		dispatch()
	})
}

function evictUntilFits(estimate: number): boolean {
	const keys = selectProceduralCacheEvictions(
		[...cache].map(([key, entry]) => ({ key, bytes: entry.bytes, settled: entry.settled })),
		cachedBytes,
		reservedBytes,
		estimate,
	)
	for (const key of keys) {
		const entry = cache.get(key)
		if (!entry) continue
		cache.delete(key)
		cachedBytes -= entry.bytes
	}
	return cachedBytes + reservedBytes + estimate <= MAX_PROCEDURAL_CACHE_BYTES
}

export function selectProceduralCacheEvictions(
	entries: { key: string, bytes: number, settled: boolean }[],
	currentBytes: number,
	reserved: number,
	incoming: number,
	budget = MAX_PROCEDURAL_CACHE_BYTES,
): string[] {
	const evictions: string[] = []
	let retained = currentBytes
	for (const entry of entries) {
		if (retained + reserved + incoming <= budget) break
		if (!entry.settled) continue
		evictions.push(entry.key)
		retained -= entry.bytes
	}
	return evictions
}

function cachedRequest<T extends ProceduralTextureResult>(
	key: string,
	request: ProceduralTextureRequest,
	priority: TexturePriority,
): Promise<T> {
	const existing = cache.get(key)
	if (existing) {
		cache.delete(key)
		cache.set(key, existing)
		return existing.promise as Promise<T>
	}
	const estimate = estimateBytes(request)
	if (estimate > MAX_PROCEDURAL_CACHE_BYTES || !evictUntilFits(estimate)) {
		return enqueue(request, priority) as Promise<T>
	}
	reservedBytes += estimate
	const entry: CacheEntry = { promise: Promise.resolve(null as never), estimateBytes: estimate, bytes: 0, settled: false }
	entry.promise = enqueue(request, priority).then((result) => {
		reservedBytes -= entry.estimateBytes
		entry.settled = true
		entry.bytes = resultBytes(result)
		cachedBytes += entry.bytes
		evictUntilFits(0)
		return result
	}).catch((error: unknown) => {
		reservedBytes -= entry.estimateBytes
		cache.delete(key)
		throw error
	})
	cache.set(key, entry)
	return entry.promise as Promise<T>
}

function requestShape(size: ProceduralTextureSize): { width: number, height: number } {
	return { width: size, height: size / 2 }
}

export function requestProceduralPlanetTexture(
	parameters: ProceduralSurfaceParameters,
	options: ProceduralTextureOptions,
): Promise<GeneratedSurface> {
	const request: ProceduralTextureRequest = { kind: 'planet', parameters, ...requestShape(options.size) }
	return cachedRequest(proceduralTextureCacheKey('planet', parameters, options.size), request, options.priority)
}

export function requestProceduralStellarTexture(
	parameters: ProceduralStellarSurfaceParameters,
	options: ProceduralTextureOptions,
): Promise<GeneratedStellarSurface> {
	const request: ProceduralTextureRequest = { kind: 'star', parameters, ...requestShape(options.size) }
	return cachedRequest(proceduralTextureCacheKey('star', parameters, options.size), request, options.priority)
}

export function proceduralTextureRuntimeStats() {
	return { cachedBytes, reservedBytes, entries: cache.size, queued: queue.length, workers: slots.length }
}

export function clearProceduralTextureCache(): void {
	cache.clear()
	cachedBytes = 0
}
