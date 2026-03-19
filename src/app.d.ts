// See https://svelte.dev/docs/kit/types#app.d.ts
import type { AuthUser } from '$lib/server/auth.js';

declare global {
	namespace App {
		interface Locals {
			user: AuthUser | null;
		}
	}
}

export {};
