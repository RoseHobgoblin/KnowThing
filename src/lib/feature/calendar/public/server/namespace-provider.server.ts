import { sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { calendars } from '../../server/schema.server.js'
import {
	buildNamespaceHref,
	missingNamespaceTarget,
	type NamespaceProvider,
} from '$lib/namespaces/providers.js'

export const calendarNamespaceProvider: NamespaceProvider = {
	namespace: 'Calendar',
	async resolve(identifier) {
		const [calendar] = await db
			.select({ id: calendars.id, slug: calendars.slug, name: calendars.name })
			.from(calendars)
			.where(sql`LOWER(${calendars.slug}) = ${identifier.toLowerCase()}`)
			.limit(1)
		return calendar
			? { kind: 'calendar', href: buildNamespaceHref('Calendar', calendar.slug), title: calendar.name, exists: true, entityId: calendar.id }
			: missingNamespaceTarget('Calendar', identifier)
	},
}
