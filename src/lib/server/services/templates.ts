import { error } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { templates } from '$lib/server/db/schema.js'

export async function listTemplates() {
	return db
		.select({
			name: templates.name,
			description: templates.description,
			updatedAt: templates.updatedAt,
		})
		.from(templates)
}

export async function getTemplate(name: string) {
	const [tmpl] = await db
		.select()
		.from(templates)
		.where(eq(templates.name, name))
		.limit(1)

	if (!tmpl) throw error(404, 'Template not found')
	return tmpl
}
