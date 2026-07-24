import { error, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types.js'
import { splitNamespaceTarget, type NamespaceKey } from '$lib/namespaces/registry.js'
import { loadCelestialDetail } from '$lib/server/loaders/celestial-detail.js'
import { loadCalendarDetail } from '$lib/server/loaders/calendar-detail.js'
import { entitySaveAction } from '$lib/server/services/entity-actions.js'

const TRAILING_MODES = new Set(['edit', 'configure', 'history', 'move'])

type Mode = 'view' | 'edit' | 'configure' | 'history' | 'move'

function peelTrailingMode(path: string): { head: string, mode: Mode } {
	const segs = path.split('/')
	const last = segs.at(-1)?.toLowerCase()
	if (last && TRAILING_MODES.has(last)) {
		segs.pop()
		return { head: segs.join('/'), mode: last as Mode }
	}
	return { head: path, mode: 'view' }
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const raw = params.ns_path
	const { head, mode } = peelTrailingMode(raw)

	const split = splitNamespaceTarget(head)
	if (!split) throw error(404, 'Unknown namespace')

	const { ns, identifier } = split
	const suffix = mode === 'view' ? '' : `/${mode}`

	switch (ns) {
		case 'Celestial': {
			if (mode === 'edit') throw error(404, 'Celestial pages no longer have articles. Edit at /know/<slug> instead.')
			const data = await loadCelestialDetail({
				identifier,
				mode: mode === 'configure' ? 'configure' : 'view',
				user: locals.user,
				loginRedirectPath: `/Celestial:${identifier}${suffix}`,
				canonicalize: slug => `/Celestial:${slug}`,
			})
			return { namespace: 'Celestial' as const, ...data }
		}
		case 'Calendar': {
			const data = await loadCalendarDetail({
				identifier,
				mode: mode === 'configure' ? 'configure' : 'view',
				user: locals.user,
				loginRedirectPath: `/Calendar:${identifier}${suffix}`,
				canonicalize: slug => `/Calendar:${slug}`,
			})
			return { namespace: 'Calendar' as const, ...data }
		}
		case 'Map':
			throw redirect(308, `/worldmap/${identifier}${suffix}`)
		case 'Template':
			throw redirect(308, `/know/Template:${identifier}${suffix}`)
		case 'File':
		case 'Image':
			throw redirect(308, `/media/${identifier}${suffix}`)
		case 'Special':
			throw redirect(308, `/special/${identifier}${suffix}`)
		case 'Country':
		case 'Category':
		case 'CarveCraft':
			throw error(404, `${ns} pages aren't wired up yet — coming in a later phase.`)
	}

	const _exhaustive: never = ns
	throw error(404, `Unhandled namespace: ${_exhaustive}`)
}

export const actions: Actions = {
	default: entitySaveAction({ editSuffix: /\/(edit|configure)$/ }),
}
