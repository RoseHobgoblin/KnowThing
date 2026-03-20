import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { lexiconVariants } from '$lib/server/db/schema.js';
import { requireAuth } from '$lib/server/auth.js';
import { eq } from 'drizzle-orm';

/** DELETE /api/wordbook/:id/variants/:variantId */
export const DELETE: RequestHandler = async (event) => {
	requireAuth(event);

	const variantId = parseInt(event.params.variantId);
	if (isNaN(variantId)) return json({ error: 'Invalid variant ID' }, { status: 400 });

	const [deleted] = await db.delete(lexiconVariants).where(eq(lexiconVariants.id, variantId)).returning();
	if (!deleted) return json({ error: 'Variant not found' }, { status: 404 });
	return json({ success: true });
};
