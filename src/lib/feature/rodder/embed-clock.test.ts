import { describe, expect, it } from 'vitest'
import {
	advanceEmbedDay,
	DEFAULT_EMBED_PLAYBACK_DAYS_PER_SECOND,
	formatEmbedDay,
	formatEmbedPlaybackRate,
	parseEmbedPlaybackRate,
} from './public/embed-clock.js'

describe('Rodder embed clock', () => {
	it('advances simulated days using elapsed real time', () => {
		expect(advanceEmbedDay(100, 250, 20)).toBe(105)
		expect(advanceEmbedDay(100, 0, 20)).toBe(100)
		expect(advanceEmbedDay(100, 250, 0)).toBe(100)
	})

	it('parses bounded playback rates with a default', () => {
		expect(parseEmbedPlaybackRate(undefined)).toBe(DEFAULT_EMBED_PLAYBACK_DAYS_PER_SECOND)
		expect(parseEmbedPlaybackRate('0.01')).toBe(0.01)
		expect(parseEmbedPlaybackRate('10000')).toBe(10_000)
		expect(parseEmbedPlaybackRate('0')).toBeNull()
		expect(parseEmbedPlaybackRate('fast')).toBeNull()
	})

	it('formats compact accessible clock values', () => {
		expect(formatEmbedDay(1234.567)).toBe('Day 1,234.57')
		expect(formatEmbedDay(null)).toBe('Date unavailable')
		expect(formatEmbedPlaybackRate(1000)).toBe('1,000 d/s')
	})
})
