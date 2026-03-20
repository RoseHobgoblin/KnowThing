import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types.js'
import { db } from '$lib/server/db/index.js'
import { templates } from '$lib/server/db/schema.js'
import { eq } from 'drizzle-orm'

/** GET /api/templates/:name — get template source */
export const GET: RequestHandler = async ({ params }) => {
	const [tmpl] = await db
		.select()
		.from(templates)
		.where(eq(templates.name, params.name))
		.limit(1)

	if (!tmpl) throw error(404, 'Template not found')
	return json(tmpl)
}
