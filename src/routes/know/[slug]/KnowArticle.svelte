<script lang="ts">
	import { untrack } from 'svelte'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext, type KnowRenderContext } from '$lib/renderer/context.js'
	import { SvelteMap } from 'svelte/reactivity'
	import CategoryBar from '$lib/components/CategoryBar.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import Badge from '$lib/components/ui/Badge.svelte'
	import { knowBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import ArrowsLeftRight from 'phosphor-svelte/lib/ArrowsLeftRight'
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
	import Trash from 'phosphor-svelte/lib/Trash'
	import type { WikiNode } from '$lib/parser/types.js'
	import { buildFieldMap, getField } from '$lib/infoboxes/types.js'
	import { detectInfoboxType } from '$lib/infoboxes/detect.js'
	import { m } from '$lib/paraglide/messages.js'

	let {
		title,
		slug,
		ast,
		categories,
		updatedAt,
		wordbookMatch,
		languageMatch,
		structuredData: rawStructuredData,
		structuredCollections,
		rodderEntities,
		rodderSectors,
		rodderDisplayOverflow,
		resolvedLinks: rawResolvedLinks,
		ondeletepage,
	}: {
		title: string
		slug: string
		ast: WikiNode
		categories: string[]
		updatedAt: string | Date | null
		wordbookMatch: { word: string, languageSlug: string, languageName: string } | null
		languageMatch: { languageSlug: string, languageName: string } | null
		structuredData: Record<string, Record<string, string>> | null
		structuredCollections: Record<string, Record<string, unknown>[]> | null
		rodderEntities: Record<string, KnowRenderContext['rodderEntities'] extends Map<string, infer T> | null ? T : never>
		rodderSectors: Record<string, KnowRenderContext['rodderSectors'] extends Map<string, infer T> | null ? T : never>
		rodderDisplayOverflow: number
		resolvedLinks: Record<string, { href: string, exists: boolean }> | null
		ondeletepage: () => void
	} = $props()

	const isAdmin = $derived($page.data.isAdmin)
	const permissions = $derived($page.data.permissions)
	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')

	// Build render context — this component is keyed by slug, so context rebuilds on navigation
	function buildStructuredData(raw: Record<string, Record<string, string>> | null) {
		if (!raw) return null
		const map = new SvelteMap<string, SvelteMap<string, string>>()
		for (const [s, fields] of Object.entries(raw)) {
			map.set(s, new SvelteMap(Object.entries(fields)))
		}
		return map
	}

	function findPersonNativeName(node: WikiNode): string {
		if (node.type === 'template') {
			const fields = buildFieldMap(node.args)
			const type = detectInfoboxType(node.name, fields)
			if (type === 'person' || type === 'royalty' || type === 'officeholder') {
				return getField(fields, 'native_name') ?? ''
			}
		}
		if ('children' in node) {
			for (const child of node.children) {
				const nativeName = findPersonNativeName(child)
				if (nativeName) return nativeName
			}
		}
		return ''
	}

	const articleSubtitle = $derived(findPersonNativeName(ast))

	// One-time capture is correct: the parent keys this component on the slug,
	// so a new article remounts it with fresh context.
	createKnowContext(untrack(() => ({
		resolvedLinks: new SvelteMap(Object.entries(rawResolvedLinks ?? {})),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: $page.data.calendarDate ?? null,
		calendarConfig: $page.data.calendarConfig ?? null,
		structuredData: buildStructuredData(rawStructuredData),
		structuredCollections: (structuredCollections ?? null) as KnowRenderContext['structuredCollections'],
		rodderEntities: new SvelteMap(Object.entries(rodderEntities)),
		rodderSectors: new SvelteMap(Object.entries(rodderSectors)),
		rodderDisplayOverflow,
	})))
</script>

<ArticleShell
	breadcrumbs={knowBreadcrumbs(title)}
	{title}
	subtitle={articleSubtitle}
>
	{#snippet actions()}
		{#if permissions.canEditContent}
			<a href={resolve('/know/[slug]/edit', { slug })} class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover"><PencilSimple size={14} weight="fill" />{m.common_edit()}</a>
			<a href={resolve('/know/[slug]/move', { slug })} class="text-dim transition-colors flex items-center gap-1 hover:text-secondary"><ArrowsLeftRight size={14} weight="fill" />{m.know_move()}</a>
			<a href={resolve('/know/[slug]/history', { slug })} class="text-dim transition-colors flex items-center gap-1 hover:text-secondary"><ClockCounterClockwise size={14} weight="fill" />{m.know_history()}</a>
		{:else if permissions.isAuthenticated}
			<span class="text-secondary text-sm">{m.common_view_only_editor()}</span>
		{/if}
		{#if isAdmin}
			<button onclick={ondeletepage} class="text-error transition-colors flex items-center gap-1 hover:text-error-hover"><Trash size={14} weight="fill" />{m.common_delete()}</button>
		{/if}
	{/snippet}

	{#snippet badges()}
		{#if wordbookMatch}
			<div class="flex items-center gap-2 mt-1.5 text-xs">
				<Badge variant="info">{wbName}</Badge>
				<a
					href={resolve('/wordbook/[language]/[word]', { language: wordbookMatch.languageSlug, word: wordbookMatch.word })}
					class="text-link transition-colors hover:text-link-hover"
				>
					See <em>{wordbookMatch.word}</em> in {wordbookMatch.languageName}
				</a>
			</div>
		{/if}
		{#if languageMatch}
			<div class="flex items-center gap-2 mt-1.5 text-xs">
				<Badge variant="info">{wbName}</Badge>
				<a
					href={resolve('/wordbook/[language]', { language: languageMatch.languageSlug })}
					class="text-link transition-colors hover:text-link-hover"
				>
					See <em>{languageMatch.languageName}</em> in the {wbName.toLowerCase()}
				</a>
			</div>
		{/if}
	{/snippet}

	{#if rodderDisplayOverflow > 0}
		<p class="mb-3 border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">{rodderDisplayOverflow} Rodder display target{rodderDisplayOverflow === 1 ? ' was' : 's were'} skipped because an article supports at most 24 unique maps.</p>
	{/if}

	<article class="know-article">
		<WikiNodeComponent node={ast} />
	</article>

	<CategoryBar {categories} />

	{#if updatedAt}
		<div class="clear-both mt-6 pt-4 border-t border-border-subtle text-xs text-secondary">
			{m.know_last_edited({ name: new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) })}
		</div>
	{/if}
</ArticleShell>
