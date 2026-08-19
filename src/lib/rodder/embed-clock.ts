export const DEFAULT_EMBED_PLAYBACK_DAYS_PER_SECOND = 10
export const EMBED_PLAYBACK_RATE_MIN = 0.01
export const EMBED_PLAYBACK_RATE_MAX = 10_000
export const EMBED_PLAYBACK_RATE_OPTIONS = [0.25, 1, 10, 100, 1_000] as const

export function advanceEmbedDay(
	currentDay: number,
	elapsedMilliseconds: number,
	daysPerSecond: number,
): number {
	if (!Number.isFinite(currentDay) || !Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds <= 0) return currentDay
	if (!Number.isFinite(daysPerSecond) || daysPerSecond <= 0) return currentDay
	return currentDay + elapsedMilliseconds / 1_000 * daysPerSecond
}

export function parseEmbedPlaybackRate(raw: string | null | undefined): number | null {
	if (raw == null || raw.trim() === '') return DEFAULT_EMBED_PLAYBACK_DAYS_PER_SECOND
	const value = Number(raw)
	return Number.isFinite(value) && value >= EMBED_PLAYBACK_RATE_MIN && value <= EMBED_PLAYBACK_RATE_MAX
		? value
		: null
}

export function formatEmbedDay(day: number | null): string {
	if (day == null || !Number.isFinite(day)) return 'Date unavailable'
	return `Day ${day.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function formatEmbedPlaybackRate(daysPerSecond: number): string {
	return `${daysPerSecond.toLocaleString('en-US', { maximumFractionDigits: 2 })} d/s`
}
