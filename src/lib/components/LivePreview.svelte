<script lang="ts">
	import { untrack } from 'svelte'
	import { SvelteMap } from 'svelte/reactivity'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext, type ResolvedLink } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import { createQuery, keepPreviousData } from '@tanstack/svelte-query'
	import { renderWikiPreview } from '$lib/renderer/render-client.js'
	import { CORE_WIKI_TEMPLATES, type BuiltinEntry } from '$lib/templates/registry.js'

	let { content = '', domain = 'know', mediaBaseUrl = '', templateComponents = CORE_WIKI_TEMPLATES }: { content: string, domain?: string, mediaBaseUrl?: string, templateComponents?: ReadonlyMap<string, BuiltinEntry> } = $props()

	let debouncedContent = $state('')
	let debounceTimer: ReturnType<typeof setTimeout>

	const layoutData = $derived($page.data)

	// Without this map the renderer paints every wikilink as a red (missing)
	// link, so the preview would report even existing pages as broken. It is
	// Filled by the render capability, which resolves targets like a save does.
	const resolvedLinks = new SvelteMap<string, ResolvedLink>()
	const extensionResources = new SvelteMap<string, unknown>()
	const entityResources = new SvelteMap<string, unknown>()
	const sectorResources = new SvelteMap<string, unknown>()
	extensionResources.set('rodder:entities', entityResources)
	extensionResources.set('rodder:sectors', sectorResources)
	let rodderDisplayOverflow = $state(0)

	// setContext runs once at init — reading current prop/store values here is
	// intentional, so untrack to silence the state_referenced_locally warning.
	untrack(() =>
		createKnowContext({
			resolvedLinks,
			mediaBaseUrl,
			pageBaseUrl: `/${domain}`,
			sourceDomain: domain,
			calendarDate: layoutData.calendarDate ?? null,
			extensionResources,
			templateComponents,
		}),
	)

	// Debounced render-capability request.
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
		queryFn: () => renderWikiPreview(debouncedContent, domain),
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
		entityResources.clear()
		for (const [key, value] of Object.entries(preview.data?.rodderEntities ?? {})) entityResources.set(key, value)
		sectorResources.clear()
		for (const [key, value] of Object.entries(preview.data?.rodderSectors ?? {})) sectorResources.set(key, value)
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
