import type { RequestEvent } from '@sveltejs/kit'
import { RateLimiterDrizzle, RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'
import { db } from './db/index.js'
import { rateLimits } from './db/schema.js'

/**
 * Application rate limiting, keyed per client address.
 *
 * Traffic is sorted into named buckets by route and method (see `bucketFor`)
 * so that a burst of cheap reads can't exhaust the same allowance as uploads or
 * login attempts. Anything not matched by a bucket is not limited at all —
 * ordinary page navigations included.
 *
 * Storage: in-process counters, because KnowThing runs as a single app
 * container (docker-compose.prod.yml declares no replicas), which makes memory
 * authoritative for the whole deployment and costs no database round-trip. The
 * exception is `credentials`, which is kept in Postgres so a brute-force block
 * survives a restart — deploys restart the app, and a lockout that a deploy
 * clears is not much of a lockout. That bucket carries an in-memory
 * `insuranceLimiter`, so if the database is unreachable the limit degrades to a
 * process-local one rather than failing open.
 *
 * If the app is ever scaled past one replica, swap `RateLimiterMemory` for
 * `RateLimiterRedis` in `limiterFor` — nothing else here changes.
 */

type BucketSpec = {
	/** Requests allowed per `duration`. */
	points: number
	/** Window length, in seconds. */
	duration: number
	/** Seconds to keep rejecting after the window is blown. Without it, the
	 *  caller is served again as soon as the window rolls over. */
	blockDuration?: number
	/** Count in Postgres rather than process memory. */
	durable?: boolean
}

export const RATE_LIMIT_BUCKETS = {
	/** Data endpoints behind a page. A single view can fan out to a handful of
	 *  these, so the ceiling is well above what browsing produces. */
	read: { points: 300, duration: 60 },
	/** Served files. Image-heavy articles issue one request per image, which is
	 *  why these don't share the `read` allowance. */
	media: { points: 600, duration: 60 },
	/** Text search runs the widest queries of any read path. */
	search: { points: 60, duration: 60 },
	/** Live preview parses wikitext on the server for anonymous callers. The
	 *  editor debounces at 300ms, so a fast typist can legitimately approach
	 *  two per second — hence the headroom despite this being the one CPU-bound
	 *  public endpoint. */
	render: { points: 120, duration: 60 },
	/** Everything else that mutates. Set with bulk editors in mind (the phoneme
	 *  and paradigm editors save one row at a time). */
	write: { points: 60, duration: 60 },
	/** Uploads decode and re-encode images through sharp, against a 15MB body
	 *  limit. Far more expensive per request than anything else here. */
	upload: { points: 20, duration: 300 },
	/** Failed credential attempts. `/auth/login` is a form action calling
	 *  `auth.api.signInUsername` directly, which bypasses Better Auth's own
	 *  limiter (that one only guards its HTTP router) — so this bucket is the
	 *  only thing standing between a password and unlimited guesses.
	 *  Spent from the actions, not the hook: see `spendCredentialAttempt`. */
	credentials: { points: 10, duration: 900, blockDuration: 900, durable: true },
} as const satisfies Record<string, BucketSpec>

export type RateLimitBucket = keyof typeof RATE_LIMIT_BUCKETS

const limiters = new Map<RateLimitBucket, RateLimiterMemory | RateLimiterDrizzle>()

/** Built on first use rather than at module scope: `vite build` evaluates server
 *  modules, and nothing here should open a database handle during a build. */
function limiterFor(bucket: RateLimitBucket) {
	const existing = limiters.get(bucket)
	if (existing) return existing

	const spec: BucketSpec = RATE_LIMIT_BUCKETS[bucket]
	const options = {
		keyPrefix: bucket,
		points: spec.points,
		duration: spec.duration,
		...(spec.blockDuration === undefined ? {} : { blockDuration: spec.blockDuration }),
	}
	const limiter = spec.durable
		? new RateLimiterDrizzle({
			...options,
			storeClient: db,
			schema: rateLimits,
			insuranceLimiter: new RateLimiterMemory(options),
			// Once a key is over its allowance, reject from process memory
			// instead of writing to Postgres — otherwise a caller who is already
			// locked out still costs a transaction per attempt.
			inMemoryBlockOnConsumed: spec.points + 1,
			inMemoryBlockDuration: spec.blockDuration ?? spec.duration,
		})
		: new RateLimiterMemory(options)

	limiters.set(bucket, limiter)
	return limiter
}

function isUnder(pathname: string, prefix: string): boolean {
	return pathname === prefix || pathname.startsWith(prefix + '/')
}

/**
 * Which bucket a request belongs to, or `null` to let it through unmetered.
 *
 * Exported for tests — it is the whole policy in one pure function.
 */
export function bucketFor(pathname: string, method: string): RateLimitBucket | null {
	const isSafe = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'

	if (isSafe) {
		// Page navigations are unmetered; only data endpoints are counted.
		if (!isUnder(pathname, '/api')) return null
		if (isUnder(pathname, '/api/media')) return 'media'
		if (isUnder(pathname, '/api/search')) return 'search'
		return 'read'
	}

	// `/auth/login` and `/auth/register` are deliberately absent: they are form
	// actions, and a 429 returned from a hook is not an ActionResult, so
	// `use:enhance` fails to deserialize it and drops the user on the error page
	// with their input gone. Those two spend from the `credentials` bucket
	// inside the action instead — see `spendCredentialAttempt`.
	//
	// Better Auth's own sign-in/sign-up routes answer JSON, so a plain 429 is
	// the right shape for them.
	if (isUnder(pathname, '/api/auth/sign-in') || isUnder(pathname, '/api/auth/sign-up')) return 'credentials'
	if (pathname === '/api/render') return 'render'
	if (isUnder(pathname, '/api/media')) return 'upload'
	return 'write'
}

export type RateLimitDecision = {
	bucket: RateLimitBucket
	allowed: boolean
	limit: number
	remaining: number
	/** Seconds until the caller may retry, or until the window resets. */
	resetSeconds: number
}

/**
 * `getClientAddress()` throws when `ADDRESS_HEADER` is configured but the header
 * is missing — which only happens for a caller that reached the app without
 * going through nginx. Bucket those together rather than 500-ing.
 */
function clientKey(event: RequestEvent): string {
	try {
		return event.getClientAddress()
	} catch {
		return 'unknown'
	}
}

/** Charge one point to `bucket`. `null` means the store failed and the request
 *  is being let through. */
async function spend(bucket: RateLimitBucket, event: RequestEvent): Promise<RateLimitDecision | null> {
	const spec: BucketSpec = RATE_LIMIT_BUCKETS[bucket]

	try {
		const result = await limiterFor(bucket).consume(clientKey(event))
		return {
			bucket,
			allowed: true,
			limit: spec.points,
			remaining: result.remainingPoints,
			resetSeconds: Math.ceil(result.msBeforeNext / 1000),
		}
	} catch (error) {
		if (error instanceof RateLimiterRes) {
			return {
				bucket,
				allowed: false,
				limit: spec.points,
				remaining: 0,
				// Always advertise at least a second, so `Retry-After: 0` never
				// invites an immediate retry.
				resetSeconds: Math.max(1, Math.ceil(error.msBeforeNext / 1000)),
			}
		}
		// Only reachable for a durable bucket whose insurance limiter also
		// failed. Let the request through rather than locking everyone out of a
		// working site because of a storage fault.
		// eslint-disable-next-line local/no-console-server -- operator signal; there is no client-facing error here, the request is being allowed
		console.error(`Rate limiter for bucket "${bucket}" failed:`, error)
		return null
	}
}

/** Charge one point to the bucket this request falls into. `null` means the
 *  request is not rate limited at all. */
export async function enforceRateLimit(event: RequestEvent): Promise<RateLimitDecision | null> {
	const bucket = bucketFor(event.url.pathname, event.request.method)
	if (!bucket) return null
	return spend(bucket, event)
}

/**
 * Charge a credential attempt, for the login and register form actions.
 *
 * Kept out of the hook so a locked-out caller receives an `ActionFailure` the
 * form can render in place, rather than a bare 429 that `use:enhance` cannot
 * deserialize. Returns `null` when the attempt is allowed; otherwise a message
 * to hand straight to `fail(429, ...)`.
 */
export async function spendCredentialAttempt(event: RequestEvent): Promise<string | null> {
	const decision = await spend('credentials', event)
	if (!decision || decision.allowed) return null

	const minutes = Math.ceil(decision.resetSeconds / 60)
	return `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/**
 * Hand the point back after the credentials turned out to be correct, so the
 * budget only ever counts failures and a user who mistypes twice before getting
 * it right is not walked closer to a lockout.
 */
export async function refundCredentialAttempt(event: RequestEvent): Promise<void> {
	try {
		await limiterFor('credentials').reward(clientKey(event))
	} catch {
		// Best effort. Failing to refund costs the caller one attempt out of ten.
	}
}

/** Advertise the caller's standing on the bucket they just spent from. Header
 *  names follow the IETF RateLimit-header draft. */
export function applyRateLimitHeaders(headers: Headers, decision: RateLimitDecision): void {
	headers.set('RateLimit-Limit', String(decision.limit))
	headers.set('RateLimit-Remaining', String(decision.remaining))
	headers.set('RateLimit-Reset', String(decision.resetSeconds))
}

/** The 429. JSON for `/api/` so `$lib/api`'s `{ error }` unwrapping shows the
 *  message; plain text elsewhere, where the browser renders the body directly. */
export function rateLimitedResponse(event: RequestEvent, decision: RateLimitDecision): Response {
	const message = `Too many requests. Try again in ${decision.resetSeconds} seconds.`
	const isApi = isUnder(event.url.pathname, '/api')
	const headers = new Headers({
		'Content-Type': isApi ? 'application/json' : 'text/plain; charset=utf-8',
		'Retry-After': String(decision.resetSeconds),
	})
	applyRateLimitHeaders(headers, decision)

	return new Response(isApi ? JSON.stringify({ error: message }) : message, {
		status: 429,
		headers,
	})
}
