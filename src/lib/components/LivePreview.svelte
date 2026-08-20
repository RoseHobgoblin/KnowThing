<script lang="ts">
	import { untrack } from 'svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext, type ResolvedLink } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import type { WikiNode } from '$lib/parser/types.js'
	import { createQuery, keepPreviousData } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import type { RodderEntityDocument, RodderSectorDocument } from '$lib/feature/rodder/consumer-contract.js'

	let { content = '', domain = 'know' }: { content: string, domain?: string } = $props()

	let debouncedContent = $state('')
	let debounceTimer: ReturnType<typeof setTimeout>

	const layoutData = $derived($page.data)

	// Without this map the renderer paints every wikilink as a red (missing)
	// link, so the preview would report even existing pages as broken. It is
	// filled from /api/render, which resolves targets the same way a save does.
	const resolvedLinks = new SvelteMap<string, ResolvedLink>()
	const rodderEntities = new SvelteMap<string, RodderEntityDocument | null>()
	const rodderSectors = new SvelteMap<string, RodderSectorDocument | null>()
	let rodderDisplayOverflow = $state(0)

	// setContext runs once at init — reading current prop/store values here is
	// intentional, so untrack to silence the state_referenced_locally warning.
	untrack(() =>
		createKnowContext({
			resolvedLinks,
			mediaBaseUrl: '/api/media',
			pageBaseUrl: `/${domain}`,
			sourceDomain: domain,
			calendarDate: layoutData.calendarDate ?? null,
			rodderEntities,
			rodderSectors,
		}),
	)

	// Debounced fetch to /api/render
	$effect(() => {
		const _c = content
		clearTimeout(debounceTimer)

		if (!_c.trim()) {
			debouncedContent = ''
			return () => clearTimeout(debounceTimer)
		}

		debounceTimer = setTimeout(() => debouncedContent = _c, 300)

		return () => clearTimeout(debounceTimer)
	})

	const preview = createQuery(() => ({
		queryKey: ['render-preview', domain, debouncedContent],
		queryFn: () => api<{
			ast: WikiNode
			resolvedLinks: Record<string, ResolvedLink>
			rodderEntities: Record<string, RodderEntityDocument | null>
			rodderSectors: Record<string, RodderSectorDocument | null>
			rodderDisplayOverflow: number
		}>(
			'POST', '/api/render', { content: debouncedContent, domain },
		),
		enabled: debouncedContent.trim().length > 0,
		// The key holds the whole document, so every settled edit is a cache miss.
		// Without this the rendered article is replaced by the loading line on each
		// one — keep showing the previous render until the new one lands.
		placeholderData: keepPreviousData,
	}))
	const ast = $derived(debouncedContent ? preview.data?.ast ?? null : null)
	const loading = $derived(preview.isFetching)

	$effect(() => {
		const links = preview.data?.resolvedLinks
		resolvedLinks.clear()
		if (links) {
			for (const [key, value] of Object.entries(links)) resolvedLinks.set(key, value)
		}
		rodderEntities.clear()
		for (const [key, value] of Object.entries(preview.data?.rodderEntities ?? {})) rodderEntities.set(key, value)
		rodderSectors.clear()
		for (const [key, value] of Object.entries(preview.data?.rodderSectors ?? {})) rodderSectors.set(key, value)
		rodderDisplayOverflow = preview.data?.rodderDisplayOverflow ?? 0
	})
</script>

<div class="h-full overflow-y-auto bg-surface p-4">
	{#if loading && !ast}
		<p class="text-sm text-secondary italic">Loading preview...</p>
	{:else if ast}
		{#if rodderDisplayOverflow > 0}
			<p class="mb-3 border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">{rodderDisplayOverflow} Rodder display target{rodderDisplayOverflow === 1 ? ' was' : 's were'} skipped because previews support at most 24 unique maps.</p>
		{/if}
		<article class="know-article">
			<WikiNodeComponent node={ast} />
		</article>
	{:else}
		<p class="text-sm text-secondary italic">Start typing to see a preview</p>
	{/if}
</div>
