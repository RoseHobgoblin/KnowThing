<script lang="ts">
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte';
	import { createKnowContext } from '$lib/renderer/context.js';
	import { page } from '$app/stores';
	import type { WikiNode } from '$lib/parser/types.js';

	let { content = '' }: { content: string } = $props();

	let ast = $state<WikiNode | null>(null);
	let loading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	const layoutData = $derived($page.data);

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know'
	});

	// Debounced fetch to /api/render
	$effect(() => {
		// Track content changes
		const _c = content;
		clearTimeout(debounceTimer);

		if (!_c.trim()) {
			ast = null;
			return;
		}

		loading = true;
		debounceTimer = setTimeout(async () => {
			try {
				const res = await fetch('/api/render', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ content: _c })
				});
				if (res.ok) {
					const data = await res.json();
					ast = data.ast;
				}
			} catch {
				// ignore
			} finally {
				loading = false;
			}
		}, 300);
	});
</script>

<div class="h-full overflow-y-auto p-4 bg-white">
	{#if loading && !ast}
		<p class="text-stone-400 text-sm italic">Loading preview...</p>
	{:else if ast}
		<article class="know-article">
			<WikiNodeComponent node={ast} />
		</article>
	{:else}
		<p class="text-stone-400 text-sm italic">Start typing to see a preview</p>
	{/if}
</div>
