import { error } from '@sveltejs/kit'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { loginAttempts, registrationCodes, sessions, users } from '$lib/server/db/schema.js'
import type { Role } from '$lib/server/auth.js'
import { deleteSession } from '$lib/server/auth.js'

const SALT_ROUNDS = 12

function createSessionRecord() {
	return {
		token: crypto.randomBytes(32).toString('hex'),
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
	}
}

export interface LoginResult {
	token: string
	redirectTo: string
	user: {
		id: number
		username: string
		role: string
	}
}

function normalizeUsername(username: string): string {
	return username.trim()
}

export function sanitizeRedirectTarget(redirectTo: string | null | undefined): string {
	if (!redirectTo) return '/'
	if (!redirectTo.startsWith('/')) return '/'
	if (redirectTo.startsWith('//')) return '/'
	return redirectTo
}

async function recordLoginAttempt(username: string, ip: string | null, success: boolean): Promise<void> {
	await db.insert(loginAttempts).values({
		username: username.toLowerCase(),
		ipAddress: ip,
		success,
	})
}

async function verifyCredentials(username: string, password: string) {
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

export async function hasAnyUser(): Promise<boolean> {
	const existing = await db.select({ id: users.id }).from(users).limit(1)
	return existing.length > 0
}

export async function checkLoginThrottle(username: string): Promise<boolean> {
	const windowStart = new Date(Date.now() - 15 * 60 * 1000)

	const [result] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(loginAttempts)
		.where(and(
			eq(loginAttempts.username, username.toLowerCase()),
			eq(loginAttempts.success, false),
			gt(loginAttempts.createdAt, windowStart),
		))

	return (result?.count ?? 0) < 5
}

export async function loginUser(input: {
	username: string
	password: string
	ip: string | null
	redirectTo?: string | null
}): Promise<LoginResult> {
	const username = normalizeUsername(input.username)
	const allowed = await checkLoginThrottle(username)
	if (!allowed) {
		throw error(429, 'Too many login attempts. Try again in 15 minutes.')
	}

	const user = await verifyCredentials(username, input.password)
	if (!user) {
		await recordLoginAttempt(username, input.ip, false)
		throw error(401, 'Invalid username or password')
	}

	await recordLoginAttempt(username, input.ip, true)
	const session = createSessionRecord()
	await db.insert(sessions).values({ userId: user.id, token: session.token, expiresAt: session.expiresAt })

	return {
		token: session.token,
		redirectTo: sanitizeRedirectTarget(input.redirectTo),
		user,
	}
}

export async function registerUser(input: {
	username: string
	password: string
	code?: string
}): Promise<{ token: string, user: { id: number, username: string, role: string } }> {
	const username = normalizeUsername(input.username)
	const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)

	type ValidRegistrationCode = {
		id: number
		role: string
	}
	const existingUsers = await db.select({ id: users.id }).from(users).limit(1)
	const isFirstUser = existingUsers.length === 0
	const now = new Date()
	let validCode: ValidRegistrationCode | null = null

	if (!isFirstUser && !input.code?.trim()) {
		throw error(400, 'Registration code is required')
	}

	if (!isFirstUser) {
		const code = input.code!.trim()
		const [regCode] = await db
			.select({ id: registrationCodes.id, role: registrationCodes.role })
			.from(registrationCodes)
			.where(and(
				eq(registrationCodes.code, code),
				isNull(registrationCodes.usedBy),
				or(
					isNull(registrationCodes.expiresAt),
					gt(registrationCodes.expiresAt, now),
				),
			))
			.limit(1)

		if (!regCode) {
			throw error(400, 'Invalid or expired registration code')
		}

		validCode = regCode
	}

	return db.transaction(async (tx) => {

		const [createdUser] = await tx
			.insert(users)
			.values({
				username,
				passwordHash,
				role: isFirstUser ? 'owner' : 'editor',
			})
			.returning({ id: users.id, username: users.username, role: users.role })

		if (validCode) {
			const [claimedCode] = await tx
				.update(registrationCodes)
				.set({ usedBy: createdUser.id, usedAt: now })
				.where(and(
					eq(registrationCodes.id, validCode.id),
					isNull(registrationCodes.usedBy),
				))
				.returning({ role: registrationCodes.role })

			if (!claimedCode) {
				throw new Error('Registration code was just used. Please request a new one.')
			}

			if (claimedCode.role !== 'editor') {
				const [updatedUser] = await tx
					.update(users)
					.set({ role: claimedCode.role })
					.where(eq(users.id, createdUser.id))
					.returning({ id: users.id, username: users.username, role: users.role })

				const session = createSessionRecord()
				await tx.insert(sessions).values({
					userId: updatedUser.id,
					token: session.token,
					expiresAt: session.expiresAt,
				})
				return { token: session.token, user: updatedUser }
			}
		}

		const session = createSessionRecord()
		await tx.insert(sessions).values({
			userId: createdUser.id,
			token: session.token,
			expiresAt: session.expiresAt,
		})
		return { token: session.token, user: createdUser }
	})
}

export async function createRegistrationCode(input: {
	createdBy: number
	role: Role
	expiresInHours?: number
	creatorRole: string
}): Promise<string> {
	if (input.role === 'admin' && input.creatorRole !== 'owner') {
		throw error(403, 'Only the owner can create admin invite codes')
	}

	const code = crypto.randomBytes(6).toString('hex')
	const expiresAt = input.expiresInHours
		? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
		: null

	await db.insert(registrationCodes).values({
		code,
		createdBy: input.createdBy,
		role: input.role,
		expiresAt,
	})

	return code
}

export async function changeOwnPassword(input: {
	userId: number
	currentPassword: string
	newPassword: string
}): Promise<void> {
	const [dbUser] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, input.userId))

	if (!dbUser) throw error(404, 'User not found')

	const valid = await bcrypt.compare(input.currentPassword, dbUser.passwordHash)
	if (!valid) throw error(401, 'Current password is incorrect')

	const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS)
	await db.update(users).set({ passwordHash }).where(eq(users.id, input.userId))
	await db.delete(sessions).where(eq(sessions.userId, input.userId))
}

export async function deleteOwnAccount(user: { id: number, role: string }): Promise<void> {
	if (user.role === 'owner') {
		throw error(400, 'The site owner cannot delete their own account')
	}

	await db.delete(sessions).where(eq(sessions.userId, user.id))
	await db.delete(users).where(eq(users.id, user.id))
}

export async function logoutSession(token: string | undefined): Promise<void> {
	if (!token) return
	await deleteSession(token)
}
