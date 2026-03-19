import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { templates } from '$lib/server/db/schema.js';

/** GET /api/templates — list all templates */
export const GET: RequestHandler = async () => {
	const result = await db
		.select({
			name: templates.name,
			description: templates.description,
			updatedAt: templates.updatedAt
		})
		.from(templates);

	return json(result);
};
