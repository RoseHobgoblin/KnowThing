<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import { getWikiContext, slugify } from '../context.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { target, display }: { target: string, display: WikiNode[] | null } = $props()

	const ctx = getWikiContext()
	const slug = $derived(slugify(target))
	const href = $derived(`${ctx.pageBaseUrl}/${slug}`)
	const exists = $derived(ctx.existingPages.has(slug))
</script>

<a
	{href}
	class="know-link {exists ? 'text-link hover:underline' : 'text-red-600 hover:underline'}"
	title={target}
>
	{#if display}
		{#each display as child}<WikiNodeComponent node={child} />{/each}
	{:else}
		{target}
	{/if}
</a>
