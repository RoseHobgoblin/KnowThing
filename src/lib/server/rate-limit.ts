const store = new Map<string, { count: number, resetAt: number }>()

const WINDOW_MS = 60_000 // 1 minute
const READ_LIMIT = 120
const WRITE_LIMIT = 30

/** Clean up expired entries every 5 minutes */
setInterval(() => {
	const now = Date.now()
	for (const [key, entry] of store) {
		if (entry.resetAt < now) store.delete(key)
	}
}, 300_000)

/**
 * Check rate limit for an IP. Returns true if request is allowed.
 */
export function checkRateLimit(ip: string, isWrite: boolean): boolean {
	const now = Date.now()
	const key = `${ip}:${isWrite ? 'w' : 'r'}`
	const limit = isWrite ? WRITE_LIMIT : READ_LIMIT

	let entry = store.get(key)
	if (!entry || entry.resetAt < now) {
		entry = { count: 0, resetAt: now + WINDOW_MS }
		store.set(key, entry)
	}

	entry.count++
	return entry.count <= limit
}
