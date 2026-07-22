<script lang="ts">
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import { useDebounce } from 'runed'
	import { api } from '$lib/api'
	import type { WikiNode } from '$lib/parser/types.js'

	let { content = '', domain = 'know' }: { content: string, domain?: string } = $props()

	let ast = $state<WikiNode | null>(null)
	let loading = $state(false)

	const layoutData = $derived($page.data)

	createKnowContext({
		mediaBaseUrl: '/api/media',
		pageBaseUrl: `/${domain}`,
		sourceDomain: domain,
		calendarDate: layoutData.calendarDate ?? null,
	})

	const render = useDebounce(async (source: string) => {
		try {
			const data = await api<{ ast: WikiNode }>('POST', '/api/render', { content: source })
			ast = data.ast
		} catch {
			// ignore
		} finally {
			loading = false
		}
	}, 300)

	// Debounced fetch to /api/render, re-run whenever content changes.
	$effect(() => {
		const source = content
		if (!source.trim()) {
			render.cancel()
			ast = null
			loading = false
			return
		}
		loading = true
		render(source)
	})
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
