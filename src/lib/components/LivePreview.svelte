<script lang="ts">
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import { api } from '$lib/api'
	import type { WikiNode } from '$lib/parser/types.js'

	let { content = '', domain = 'know' }: { content: string, domain?: string } = $props()

	let ast = $state<WikiNode | null>(null)
	let loading = $state(false)
	let debounceTimer: ReturnType<typeof setTimeout>

	const layoutData = $derived($page.data)

	createKnowContext({
		mediaBaseUrl: '/api/media',
		pageBaseUrl: `/${domain}`,
		sourceDomain: domain,
		calendarDate: layoutData.calendarDate ?? null,
	})

	// Debounced fetch to /api/render
	$effect(() => {
		// Track content changes
		const _c = content
		clearTimeout(debounceTimer)

		if (!_c.trim()) {
			ast = null
			return () => clearTimeout(debounceTimer)
		}

		loading = true
		debounceTimer = setTimeout(async () => {
			try {
				const data = await api<{ ast: WikiNode }>('POST', '/api/render', { content: _c })
				ast = data.ast
			} catch {
				// ignore
			} finally {
				loading = false
			}
		}, 300)

		return () => clearTimeout(debounceTimer)
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
