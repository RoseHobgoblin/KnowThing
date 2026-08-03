import bcrypt from 'bcrypt'
import { getRequestEvent } from '$app/server'
import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { username } from 'better-auth/plugins'
import { sveltekitCookies } from 'better-auth/svelte-kit'
import { db } from './db/index.js'
import { accounts, authRateLimits, sessions, users, verifications } from './db/schema.js'

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.ORIGIN ?? 'http://localhost:5173'
const configuredOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
	?.split(',')
	.map(origin => origin.trim())
	.filter(Boolean) ?? []
export const authTrustedOrigins = new Set([
	new URL(baseURL).origin,
	...configuredOrigins.map(origin => new URL(origin).origin),
])
const ipAddressHeaders = process.env.BETTER_AUTH_IP_HEADERS
	?.split(',')
	.map(header => header.trim().toLowerCase())
	.filter(Boolean)
const trustedProxies = process.env.BETTER_AUTH_TRUSTED_PROXIES
	?.split(',')
	.map(proxy => proxy.trim())
	.filter(Boolean)

export const auth = betterAuth({
	appName: 'KnowThing',
	baseURL,
	trustedOrigins: [...authTrustedOrigins],
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: users,
			session: sessions,
			account: accounts,
			verification: verifications,
			rateLimit: authRateLimits,
		},
	}),
	emailAndPassword: {
		enabled: true,
		disableSignUp: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		password: {
			hash: hashPassword,
			verify: async ({ hash, password }) => hash.startsWith('$2')
				? bcrypt.compare(password, hash)
				: verifyPassword({ hash, password }),
		},
	},
	user: {
		additionalFields: {
			role: {
				type: 'string',
				required: true,
				defaultValue: 'editor',
				input: false,
			},
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 30,
		updateAge: 60 * 60 * 24,
		cookieCache: { enabled: false },
	},
	rateLimit: {
		enabled: true,
		storage: 'database',
		customRules: {
			'/sign-in/username': { window: 60, max: 5 },
		},
	},
	disabledPaths: ['/sign-up/email', '/is-username-available', '/update-user'],
	advanced: {
		cookiePrefix: 'knowthing',
		database: { generateId: 'serial' },
		ipAddress: {
			...(ipAddressHeaders?.length ? { ipAddressHeaders } : {}),
			...(trustedProxies?.length ? { trustedProxies } : {}),
		},
	},
	plugins: [
		username({
			minUsernameLength: 3,
			maxUsernameLength: 64,
			usernameValidator: value => /^[^@\s]+$/u.test(value),
		}),
		sveltekitCookies(getRequestEvent),
	],
})

export type BetterAuthSession = typeof auth.$Infer.Session
