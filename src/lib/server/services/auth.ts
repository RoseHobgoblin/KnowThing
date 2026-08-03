import crypto from 'node:crypto'
import { error } from '@sveltejs/kit'
import { hashPassword } from 'better-auth/crypto'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '$lib/server/db/index.js'
import { accounts, registrationCodes, sessions, users } from '$lib/server/db/schema.js'
import type { Role } from '$lib/server/auth.js'

function normalizeUsername(username: string): string {
	return username.trim().toLowerCase()
}

export function sanitizeRedirectTarget(redirectTo: string | null | undefined): string {
	if (!redirectTo?.startsWith('/') || redirectTo.startsWith('//')) return '/'
	return redirectTo
}

export async function hasAnyUser(): Promise<boolean> {
	const existing = await db.select({ id: users.id }).from(users).limit(1)
	return existing.length > 0
}

/** Lazily replace a verified legacy bcrypt credential with Better Auth's scrypt format. */
export async function upgradeLegacyPassword(username: string, plainTextPassword: string): Promise<void> {
	const [credential] = await db
		.select({ id: accounts.id, password: accounts.password })
		.from(accounts)
		.innerJoin(users, eq(accounts.userId, users.id))
		.where(and(
			eq(users.username, normalizeUsername(username)),
			eq(accounts.providerId, 'credential'),
		))
		.limit(1)

	if (!credential?.password?.startsWith('$2')) return
	const upgradedPassword = await hashPassword(plainTextPassword)
	await db
		.update(accounts)
		.set({ password: upgradedPassword, updatedAt: new Date() })
		.where(and(eq(accounts.id, credential.id), eq(accounts.password, credential.password)))
}

/**
 * Registration remains an application concern because KnowThing uses invite
 * codes rather than public email signup. Credentials are written in Better
 * Auth's account format and all sessions are subsequently created by it.
 */
export async function registerUser(input: {
	username: string
	password: string
	code?: string
}): Promise<{ id: number, username: string, role: Role }> {
	const displayUsername = input.username.trim()
	const username = normalizeUsername(displayUsername)
	const password = await hashPassword(input.password)
	const now = new Date()

	return db.transaction(async (tx) => {
		// Serialise first-owner selection; without this, two empty-site signups
		// can both observe zero users and both become owner.
		await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('knowthing:first-owner'))`)

		const [existingUser] = await tx.select({ id: users.id }).from(users).limit(1)
		const isFirstUser = !existingUser
		let role: Role = 'owner'
		let registrationCodeId: number | null = null

		if (!isFirstUser) {
			const code = input.code?.trim()
			if (!code) throw error(400, 'Registration code is required')

			const [registrationCode] = await tx
				.select({ id: registrationCodes.id, role: registrationCodes.role })
				.from(registrationCodes)
				.where(and(
					eq(registrationCodes.code, code),
					isNull(registrationCodes.usedBy),
					or(isNull(registrationCodes.expiresAt), gt(registrationCodes.expiresAt, now)),
				))
				.limit(1)

			if (!registrationCode) throw error(400, 'Invalid or expired registration code')
			registrationCodeId = registrationCode.id
			role = registrationCode.role as Role
		}

		const [createdUser] = await tx
			.insert(users)
			.values({
				username,
				displayUsername,
				name: displayUsername,
				email: `user-${crypto.randomUUID()}@users.knowthing.invalid`,
				emailVerified: false,
				role,
				updatedAt: now,
			})
			.returning({ id: users.id, username: users.displayUsername, role: users.role })

		await tx.insert(accounts).values({
			accountId: String(createdUser.id),
			providerId: 'credential',
			userId: createdUser.id,
			password,
			createdAt: now,
			updatedAt: now,
		})

		if (registrationCodeId !== null) {
			const [claimedCode] = await tx
				.update(registrationCodes)
				.set({ usedBy: createdUser.id, usedAt: now })
				.where(and(
					eq(registrationCodes.id, registrationCodeId),
					isNull(registrationCodes.usedBy),
				))
				.returning({ id: registrationCodes.id })
			if (!claimedCode) throw error(409, 'Registration code was just used. Please request a new one.')
		}

		return {
			id: createdUser.id,
			username: createdUser.username ?? displayUsername,
			role: createdUser.role as Role,
		}
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

	const code = crypto.randomBytes(16).toString('base64url')
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

export async function deleteOwnAccount(user: { id: number, role: string }): Promise<void> {
	if (user.role === 'owner') throw error(400, 'The site owner cannot delete their own account')
	await db.delete(users).where(eq(users.id, user.id))
}

/** Ensure sensitive account changes invalidate every server-side session. */
export async function revokeAllUserSessions(userId: number): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId))
}
