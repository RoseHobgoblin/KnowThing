import { generateProceduralSurface, type GeneratedSurface, type ProceduralSurfaceParameters } from './procedural-surface.js'
import {
	generateProceduralStellarSurface,
	type GeneratedStellarSurface,
	type ProceduralStellarSurfaceParameters,
} from './procedural-stellar-surface.js'
import type { ProceduralTextureRequest, ProceduralTextureResult } from './procedural-texture-worker.js'

type Job = {
	id: number
	request: ProceduralTextureRequest
	resolve: (result: ProceduralTextureResult) => void
	reject: (error: Error) => void
}

type WorkerSlot = {
	worker: Worker
	job: Job | null
	failed: boolean
}

const LIVE_TEXTURE_WIDTH = 1_024
const LIVE_TEXTURE_HEIGHT = 512
const MAX_CACHE_ENTRIES = 12
const queue: Job[] = []
const slots: WorkerSlot[] = []
const cache = new Map<string, Promise<ProceduralTextureResult>>()
let nextId = 1

function generateSynchronously(request: ProceduralTextureRequest): ProceduralTextureResult {
	return request.kind === 'planet'
		? generateProceduralSurface(request.parameters, request.width, request.height)
		: generateProceduralStellarSurface(request.parameters, request.width, request.height)
}

function dispatch(): void {
	for (const slot of slots) {
		if (slot.job || slot.failed) continue
		const job = queue.shift()
		if (!job) return
		slot.job = job
		slot.worker.postMessage({ id: job.id, request: job.request })
	}
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
	if (slots.length > 0) return true
	if (typeof Worker === 'undefined') return false
	const hardwareConcurrency = globalThis.navigator?.hardwareConcurrency ?? 2
	const workerCount = Math.min(3, Math.max(1, hardwareConcurrency - 1))
	for (let index = 0; index < workerCount; index++) {
		const worker = new Worker(new URL('./procedural-texture-worker.ts', import.meta.url), { type: 'module' })
		const slot: WorkerSlot = { worker, job: null, failed: false }
		worker.onmessage = (event: MessageEvent<{ id: number, result?: ProceduralTextureResult, error?: string }>) => {
			if (!slot.job || event.data.id !== slot.job.id) return
			finish(
				slot,
				event.data.result ?? null,
				event.data.error ? new Error(event.data.error) : null,
			)
		}
		worker.onerror = () => {
			const failedJob = slot.job
			slot.job = null
			slot.failed = true
			worker.terminate()
			if (failedJob) {
				// Contexts without functional module workers still get the texture;
				// this recovery is intentionally exceptional because it blocks the UI.
				try {
					failedJob.resolve(generateSynchronously(failedJob.request))
				} catch (error) {
					failedJob.reject(error instanceof Error ? error : new Error('Procedural texture generation failed'))
				}
			}
			if (slots.every(candidate => candidate.failed)) {
				for (const queued of queue.splice(0)) {
					try {
						queued.resolve(generateSynchronously(queued.request))
					} catch (error) {
						queued.reject(error instanceof Error ? error : new Error('Procedural texture generation failed'))
					}
				}
			} else {
				dispatch()
			}
		}
		slots.push(slot)
	}
	return true
}

function cachedRequest<T extends ProceduralTextureResult>(key: string, request: ProceduralTextureRequest): Promise<T> {
	const existing = cache.get(key)
	if (existing) {
		// Refresh insertion order so frequently revisited bodies survive eviction.
		cache.delete(key)
		cache.set(key, existing)
		return existing as Promise<T>
	}
	while (cache.size >= MAX_CACHE_ENTRIES) {
		const oldest = cache.keys().next().value as string | undefined
		if (oldest == null) break
		cache.delete(oldest)
	}
	const promise = ensureWorkers()
		? new Promise<ProceduralTextureResult>((resolve, reject) => {
			queue.push({ id: nextId++, request, resolve, reject })
			dispatch()
		})
		: Promise.resolve(generateSynchronously(request))
	cache.set(key, promise)
	void promise.catch(() => cache.delete(key))
	return promise as Promise<T>
}

export function requestProceduralPlanetTexture(parameters: ProceduralSurfaceParameters): Promise<GeneratedSurface> {
	const request: ProceduralTextureRequest = {
		kind: 'planet', parameters, width: LIVE_TEXTURE_WIDTH, height: LIVE_TEXTURE_HEIGHT,
	}
	return cachedRequest(`planet:${JSON.stringify(request)}`, request)
}

export function requestProceduralStellarTexture(
	parameters: ProceduralStellarSurfaceParameters,
): Promise<GeneratedStellarSurface> {
	const request: ProceduralTextureRequest = {
		kind: 'star', parameters, width: LIVE_TEXTURE_WIDTH, height: LIVE_TEXTURE_HEIGHT,
	}
	return cachedRequest(`star:${JSON.stringify(request)}`, request)
}
