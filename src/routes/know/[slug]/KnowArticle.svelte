<script lang="ts">
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext, type KnowRenderContext } from '$lib/renderer/context.js'
	import { SvelteMap } from 'svelte/reactivity'
	import CategoryBar from '$lib/components/CategoryBar.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Badge from '$lib/components/ui/Badge.svelte'
	import { knowBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import ArrowsLeftRight from 'phosphor-svelte/lib/ArrowsLeftRight'
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
	import Trash from 'phosphor-svelte/lib/Trash'
	import type { WikiNode } from '$lib/parser/types.js'

	let {
		title,
		slug,
		ast,
		categories,
		updatedAt,
		wordbookMatch,
		structuredData: rawStructuredData,
		structuredCollections,
		systemMaps,
		resolvedLinks: rawResolvedLinks,
		ondeletepage,
	}: {
		title: string
		slug: string
		ast: WikiNode
		categories: string[]
		updatedAt: string | Date | null
		wordbookMatch: { word: string, languageSlug: string, languageName: string } | null
		structuredData: Record<string, Record<string, string>> | null
		structuredCollections: Record<string, Record<string, unknown>[]> | null
		systemMaps: Record<string, unknown> | null
		resolvedLinks: Record<string, { href: string, exists: boolean }> | null
		ondeletepage: () => void
	} = $props()

	const isAdmin = $derived($page.data.isAdmin)
	const permissions = $derived($page.data.permissions)

	// Build render context — this component is keyed by slug, so context rebuilds on navigation
	function buildStructuredData(raw: Record<string, Record<string, string>> | null) {
		if (!raw) return null
		const map = new SvelteMap<string, SvelteMap<string, string>>()
		for (const [s, fields] of Object.entries(raw)) {
			map.set(s, new SvelteMap(Object.entries(fields)))
		}
		return map
	}

	createKnowContext({
		resolvedLinks: new SvelteMap(Object.entries(rawResolvedLinks ?? {})),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: $page.data.calendarDate ?? null,
		calendarConfig: $page.data.calendarConfig ?? null,
		structuredData: buildStructuredData(rawStructuredData),
		structuredCollections: (structuredCollections ?? null) as KnowRenderContext['structuredCollections'],
		systemMaps: systemMaps as KnowRenderContext['systemMaps'],
	})
</script>

<ArticleShell
	breadcrumbs={knowBreadcrumbs(title)}
	{title}
>
	{#snippet actions()}
		{#if permissions.canEditContent}
			<a href="/know/{slug}/edit" class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover"><PencilSimple size={14} weight="fill" />Edit</a>
			<a href="/know/{slug}/move" class="text-dim transition-colors flex items-center gap-1 hover:text-secondary"><ArrowsLeftRight size={14} weight="fill" />Move</a>
			<a href="/know/{slug}/history" class="text-dim transition-colors flex items-center gap-1 hover:text-secondary"><ClockCounterClockwise size={14} weight="fill" />History</a>
		{:else if permissions.isAuthenticated}
			<span class="text-faint text-sm">View only. Editor role required for page actions.</span>
		{/if}
		{#if isAdmin}
			<button onclick={ondeletepage} class="text-error transition-colors flex items-center gap-1 hover:text-error-hover"><Trash size={14} weight="fill" />Delete</button>
		{/if}
	{/snippet}

	{#snippet badges()}
		{#if wordbookMatch}
			<div class="flex items-center gap-2 mt-1.5 text-xs">
				<Badge variant="info">Wordbook</Badge>
				<a
					href="/Wordbook/{wordbookMatch.languageSlug}/{encodeURIComponent(wordbookMatch.word)}"
					class="text-link transition-colors hover:text-link-hover"
				>
					See <em>{wordbookMatch.word}</em> in {wordbookMatch.languageName}
				</a>
			</div>
		{/if}
	{/snippet}

	<article class="know-article">
		<WikiNodeComponent node={ast} />
	</article>

	<CategoryBar {categories} />

	{#if updatedAt}
		<div class="clear-both mt-6 pt-4 border-t border-border-subtle text-xs text-faint">
			Last edited {new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
		</div>
	{/if}
</ArticleShell>
