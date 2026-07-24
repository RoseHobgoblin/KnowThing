<script lang="ts">
	import { untrack } from 'svelte'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import type { WikiNode } from '$lib/parser/types.js'
	import { createQuery } from '@tanstack/svelte-query'
	import { api } from '$lib/api'

	let { content = '', domain = 'know' }: { content: string, domain?: string } = $props()

	let debouncedContent = $state('')
	let debounceTimer: ReturnType<typeof setTimeout>

	const layoutData = $derived($page.data)

	// setContext runs once at init — reading current prop/store values here is
	// intentional, so untrack to silence the state_referenced_locally warning.
	untrack(() =>
		createKnowContext({
			mediaBaseUrl: '/api/media',
			pageBaseUrl: `/${domain}`,
			sourceDomain: domain,
			calendarDate: layoutData.calendarDate ?? null,
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
		queryKey: ['render-preview', debouncedContent],
		queryFn: () => api<{ ast: WikiNode }>('POST', '/api/render', { content: debouncedContent }),
		enabled: debouncedContent.trim().length > 0,
	}))
	const ast = $derived(debouncedContent ? preview.data?.ast ?? null : null)
	const loading = $derived(preview.isFetching)
</script>

<div class="h-full overflow-y-auto p-4 bg-surface">
	{#if loading && !ast}
		<p class="text-secondary text-sm italic">Loading preview...</p>
	{:else if ast}
		<article class="know-article">
			<WikiNodeComponent node={ast} />
		</article>
	{:else}
		<p class="text-secondary text-sm italic">Start typing to see a preview</p>
	{/if}
</div>
