import { json } from '@sveltejs/kit'
import { z } from 'zod'
import type { RequestHandler } from './$types.js'
import {
	displayInteractionPolicySchema,
	rodderDiagnosticSchema,
	rodderDisplayConfigSchema,
	rodderEntityDocumentSchema,
	rodderSectorDocumentSchema,
} from '$lib/feature/rodder/consumer-contract.js'
import { rodderViewSchema } from '$lib/feature/rodder/view-state.js'

function jsonSchema(schema: z.ZodType) {
	return z.toJSONSchema(schema, { unrepresentable: 'any' })
}

/** Machine-readable public Rodder read and display contracts. */
export const GET: RequestHandler = ({ url }) => json({
	entity: jsonSchema(rodderEntityDocumentSchema),
	sector: jsonSchema(rodderSectorDocumentSchema),
	viewState: jsonSchema(rodderViewSchema),
	displayConfiguration: jsonSchema(rodderDisplayConfigSchema),
	diagnostic: jsonSchema(rodderDiagnosticSchema),
	interactionPolicy: jsonSchema(displayInteractionPolicySchema),
}, url.searchParams.get('download') === '1'
	? { headers: { 'content-disposition': 'attachment; filename*=UTF-8\'\'rodder-schemas.json' } }
	: undefined)
