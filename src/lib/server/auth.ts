import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import { db } from './db/index.js'
import { users, sessions, registrationCodes, loginAttempts } from './db/schema.js'
import { eq, and, gt, sql } from 'drizzle-orm'
import type { RequestEvent } from '@sveltejs/kit'

const SALT_ROUNDS = 12
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const COOKIE_NAME = 'session'

// Login throttling: max 5 failed attempts per 15 minutes per username
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000

// Role hierarchy: owner > admin > editor > viewer
export const ROLE_HIERARCHY = ['viewer', 'editor', 'admin', 'owner'] as const
export type Role = (typeof ROLE_HIERARCHY)[number]

export interface AuthUser {
	id: number
	username: string
	role: string
}

/** Check if a role has at least the specified minimum role level */
export function hasRole(userRole: string, minimumRole: Role): boolean {
	const userLevel = ROLE_HIERARCHY.indexOf(userRole as Role)
	const requiredLevel = ROLE_HIERARCHY.indexOf(minimumRole)
	return userLevel >= requiredLevel
}

export async function createUser(
	username: string,
	password: string,
	role?: string,
): Promise<AuthUser> {
	const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

	// First user gets owner role
	if (!role) {
		const existingUsers = await db.select({ id: users.id }).from(users).limit(1)
		role = existingUsers.length === 0 ? 'owner' : 'editor'
	}

	const [user] = await db
		.insert(users)
		.values({ username, passwordHash, role })
		.returning({ id: users.id, username: users.username, role: users.role })

	return user
}

/** Check login throttle — returns true if login is allowed */
export async function checkLoginThrottle(username: string): Promise<boolean> {
	const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS)

	const [result] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(loginAttempts)
		.where(and(
			eq(loginAttempts.username, username.toLowerCase()),
			eq(loginAttempts.success, false),
			gt(loginAttempts.createdAt, windowStart),
		))

	return (result?.count ?? 0) < MAX_LOGIN_ATTEMPTS
}

/** Record a login attempt */
export async function recordLoginAttempt(username: string, ip: string | null, success: boolean): Promise<void> {
	await db.insert(loginAttempts).values({
		username: username.toLowerCase(),
		ipAddress: ip,
		success,
	})
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

/** Change a user's password */
export async function changePassword(userId: number, newPassword: string): Promise<void> {
	const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
	await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
	// Invalidate all sessions for this user
	await db.delete(sessions).where(eq(sessions.userId, userId))
}

/** Delete a user and all their sessions */
export async function deleteUser(userId: number): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId))
	await db.delete(users).where(eq(users.id, userId))
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

// ── Registration codes ──────────────────────────────────────

/** Generate a registration code */
export async function generateRegistrationCode(
	createdBy: number,
	role: Role = 'editor',
	expiresInHours?: number,
): Promise<string> {
	const code = crypto.randomBytes(6).toString('hex')
	const expiresAt = expiresInHours
		? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
		: null

	await db.insert(registrationCodes).values({
		code,
		createdBy,
		role,
		expiresAt,
	})

	return code
}

/** Validate and consume a registration code. Returns the role it grants. */
export async function consumeRegistrationCode(code: string, userId: number): Promise<string | null> {
	const [regCode] = await db
		.select()
		.from(registrationCodes)
		.where(eq(registrationCodes.code, code))
		.limit(1)

	if (!regCode) return null
	if (regCode.usedBy) return null
	if (regCode.expiresAt && regCode.expiresAt < new Date()) return null

	await db
		.update(registrationCodes)
		.set({ usedBy: userId, usedAt: new Date() })
		.where(eq(registrationCodes.id, regCode.id))

	return regCode.role
}

// ── Cookie helpers ──────────────────────────────────────────

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

// ── Auth guards ─────────────────────────────────────────────

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

/** Require a minimum role level — returns user or throws 403 */
export function requireRole(event: RequestEvent, minimumRole: Role): AuthUser {
	const user = requireAuth(event)
	if (!hasRole(user.role, minimumRole)) {
		throw Response.json({ error: 'Insufficient permissions' }, {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		})
	}
	return user
}

export function requireAuthenticatedUser(event: RequestEvent): AuthUser {
	return requireAuth(event)
}

export function requireEditorUser(event: RequestEvent): AuthUser {
	return requireRole(event, 'editor')
}

export function requireAdminUser(event: RequestEvent): AuthUser {
	return requireRole(event, 'admin')
}

export function requireOwnerUser(event: RequestEvent): AuthUser {
	const user = requireAuth(event)
	if (user.role !== 'owner') {
		throw Response.json({ error: 'Insufficient permissions' }, {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		})
	}
	return user
}
