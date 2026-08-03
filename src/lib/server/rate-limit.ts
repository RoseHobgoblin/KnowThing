import { sql } from 'drizzle-orm'
import { db } from './db/index.js'
import { authRateLimits } from './db/schema.js'

const WINDOW_MS = 60_000
const READ_LIMIT = 120
const WRITE_LIMIT = 30

/**
 * A fixed-window limiter shared by every application instance. Better Auth
 * uses the same table with separate keys for its stricter endpoint rules.
 */
export async function checkRateLimit(
	ip: string,
	isWrite: boolean,
	options?: { scope: string, limit: number },
): Promise<boolean> {
	const now = Date.now()
	const windowStart = now - WINDOW_MS
	const scope = options?.scope ?? (isWrite ? 'write' : 'read')
	const key = `app:${ip}:${scope}`
	const limit = options?.limit ?? (isWrite ? WRITE_LIMIT : READ_LIMIT)

	const [entry] = await db
		.insert(authRateLimits)
		.values({ key, count: 1, lastRequest: now })
		.onConflictDoUpdate({
			target: authRateLimits.key,
			set: {
				count: sql<number>`
					CASE
						WHEN ${authRateLimits.lastRequest} < ${windowStart} THEN 1
						ELSE ${authRateLimits.count} + 1
					END
				`,
				lastRequest: sql<number>`
					CASE
						WHEN ${authRateLimits.lastRequest} < ${windowStart} THEN ${now}
						ELSE ${authRateLimits.lastRequest}
					END
				`,
			},
		})
		.returning({ count: authRateLimits.count })

	return entry.count <= limit
}
