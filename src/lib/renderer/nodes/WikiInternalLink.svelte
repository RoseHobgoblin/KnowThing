<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import { getWikiContext, slugify } from '../context.js'
	import WikiNodeComponent from '../WikiNode.svelte'
	import LinkPreview from '$lib/components/LinkPreview.svelte'

	let { target, display }: { target: string, display: WikiNode[] | null } = $props()

	const ctx = getWikiContext()
	const slug = $derived(slugify(target))
	const href = $derived(`${ctx.pageBaseUrl}/${slug}`)
	const exists = $derived(ctx.existingPages.has(slug))

	let showPreview = $state(false)
	let previewX = $state(0)
	let previewY = $state(0)
	let hoverTimeout: ReturnType<typeof setTimeout> | undefined

	function onMouseEnter(event: MouseEvent) {
		if (!exists) return
		previewX = event.clientX
		previewY = event.clientY
		hoverTimeout = setTimeout(() => {
			showPreview = true
		}, 400)
	}

	function onMouseMove(event: MouseEvent) {
		if (!showPreview) {
			previewX = event.clientX
			previewY = event.clientY
		}
	}

	function onMouseLeave() {
		clearTimeout(hoverTimeout)
		showPreview = false
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<a
	{href}
	class="know-link {exists ? 'text-link hover:underline' : 'text-red-600 hover:underline'}"
	title={exists && showPreview ? undefined : target}
	onmouseenter={onMouseEnter}
	onmousemove={onMouseMove}
	onmouseleave={onMouseLeave}
>
	{#if display}
		{#each display as child}<WikiNodeComponent node={child} />{/each}
	{:else}
		{target}
	{/if}
</a>

{#if showPreview}
	<LinkPreview {slug} x={previewX} y={previewY} />
{/if}
