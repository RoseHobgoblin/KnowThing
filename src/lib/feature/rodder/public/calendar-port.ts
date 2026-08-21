export type RodderCalendarProjection = {
	id: number
	name: string
	staticData: Record<string, unknown> | null
	planetId: number | null
}

export interface RodderCalendarPort {
	calendarsForRoot(rootId: number): Promise<RodderCalendarProjection[]>
}
