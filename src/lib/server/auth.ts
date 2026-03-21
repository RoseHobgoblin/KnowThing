import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import { db } from './db/index.js'
import { users, sessions } from './db/schema.js'
import { eq, and, gt } from 'drizzle-orm'
import type { RequestEvent } from '@sveltejs/kit'

const SALT_ROUNDS = 12
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const COOKIE_NAME = 'session'

export interface AuthUser {
	id: number
	username: string
	role: string
}

export async function createUser(
	username: string,
	password: string,
): Promise<AuthUser> {
	const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

	// First user gets admin role
	const existingUsers = await db.select({ id: users.id }).from(users).limit(1)
	const role = existingUsers.length === 0 ? 'admin' : 'editor'

	const [user] = await db
		.insert(users)
		.values({ username, passwordHash, role })
		.returning({ id: users.id, username: users.username, role: users.role })

	return user
}

export async function verifyCredentials(
	username: string,
	password: string,
): Promise<AuthUser | null> {
	const [user] = await db
		.select({
			id: users.id,
			username: users.username,
			passwordHash: users.passwordHash,
			role: users.role,
		})
		.from(users)
		.where(eq(users.username, username))
		.limit(1)

	if (!user) return null

	const valid = await bcrypt.compare(password, user.passwordHash)
	if (!valid) return null

	return { id: user.id, username: user.username, role: user.role }
}

export async function createSession(userId: number): Promise<string> {
	const token = crypto.randomBytes(32).toString('hex')
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

	await db.insert(sessions).values({ userId, token, expiresAt })
	return token
}

export async function resolveSession(token: string): Promise<AuthUser | null> {
	const [result] = await db
		.select({
			userId: sessions.userId,
			username: users.username,
			role: users.role,
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
		.limit(1)

	if (!result) return null
	return { id: result.userId, username: result.username, role: result.role }
}

export async function deleteSession(token: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.token, token))
}

export function setSessionCookie(event: RequestEvent, token: string): void {
	event.cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.ORIGIN?.startsWith('https://') ?? false,
		maxAge: SESSION_DURATION_MS / 1000,
	})
}

export function clearSessionCookie(event: RequestEvent): void {
	event.cookies.delete(COOKIE_NAME, { path: '/' })
}

export function getSessionToken(event: RequestEvent): string | undefined {
	return event.cookies.get(COOKIE_NAME)
}

/** Require auth — returns user or throws 401 */
export function requireAuth(event: RequestEvent): AuthUser {
	const user = event.locals.user
	if (!user) {
		throw Response.json({ error: 'Authentication required' }, {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		})
	}
	return user
}

/** Require a specific role — returns user or throws 403 */
export function requireRole(event: RequestEvent, role: string): AuthUser {
	const user = requireAuth(event)
	if (user.role !== role) {
		throw Response.json({ error: 'Insufficient permissions' }, {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		})
	}
	return user
}
