import type { LayoutServerLoad } from './$types.js';
import { requireEditor } from '$lib/server/guards.js';

export const load: LayoutServerLoad = async (event) => {
	const user = requireEditor(event);
	return { user };
};
