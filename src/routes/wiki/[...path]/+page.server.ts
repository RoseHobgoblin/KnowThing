import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

/** Backwards-compat redirect: /wiki/* → /know/* */
export const load: PageServerLoad = async ({ params }) => {
	throw redirect(301, `/know/${params.path}`);
};
