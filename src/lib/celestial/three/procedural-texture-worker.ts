/// <reference lib="webworker" />

import { generateProceduralSurface, type GeneratedSurface, type ProceduralSurfaceParameters } from './procedural-surface.js'
import {
	generateProceduralStellarSurface,
	type GeneratedStellarSurface,
	type ProceduralStellarSurfaceParameters,
} from './procedural-stellar-surface.js'

export type ProceduralTextureRequest =
	| { kind: 'planet', parameters: ProceduralSurfaceParameters, width: number, height: number }
	| { kind: 'star', parameters: ProceduralStellarSurfaceParameters, width: number, height: number }

export type ProceduralTextureResult = GeneratedSurface | GeneratedStellarSurface

type RequestMessage = { id: number, request: ProceduralTextureRequest }
type ResponseMessage = { id: number, result?: ProceduralTextureResult, error?: string }

const workerScope = self as unknown as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<RequestMessage>) => {
	const { id, request } = event.data
	try {
		if (request.kind === 'planet') {
			const result = generateProceduralSurface(request.parameters, request.width, request.height)
			const transfers: Transferable[] = [result.albedo.buffer, result.roughness.buffer]
			if (result.elevation) transfers.push(result.elevation.buffer)
			if (result.clouds) transfers.push(result.clouds.buffer)
			workerScope.postMessage({ id, result } satisfies ResponseMessage, transfers)
			return
		}
		const result = generateProceduralStellarSurface(request.parameters, request.width, request.height)
		workerScope.postMessage(
			{ id, result } satisfies ResponseMessage,
			[result.photosphere.buffer],
		)
	} catch (error) {
		workerScope.postMessage({
			id,
			error: error instanceof Error ? error.message : 'Procedural texture generation failed',
		} satisfies ResponseMessage)
	}
}

export {}
