import { calendarProjectionsForBodyIds } from '$lib/feature/calendar/public/server/projections.server.js'
import type { RodderCalendarPort } from '$lib/feature/rodder/public/calendar-port.js'
import { listRootBodyIds } from '$lib/feature/rodder/public/server/registry.server.js'

export const RODDER_CALENDAR_PORT: RodderCalendarPort = {
	async calendarsForRoot(rootId) {
		return calendarProjectionsForBodyIds(await listRootBodyIds(rootId), true)
	},
}
