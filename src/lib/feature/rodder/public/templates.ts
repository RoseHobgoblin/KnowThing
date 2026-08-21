import type { BuiltinEntry } from '$lib/templates/registry.js'
import RootMapTemplate from './ui/RootMapTemplate.svelte'
import SectorMapTemplate from './ui/SectorMapTemplate.svelte'

export const RODDER_WIKI_TEMPLATES: ReadonlyMap<string, BuiltinEntry> = new Map([
	['root map', { component: RootMapTemplate }],
	['sector map', { component: SectorMapTemplate }],
])
