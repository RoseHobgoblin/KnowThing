<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import { getKnowContext, slugify } from '../context.js'
	import WikiNodeComponent from '../WikiNode.svelte'
	import LinkPreview from '$lib/components/LinkPreview.svelte'

	let { target, display }: { target: string, display: WikiNode[] | null } = $props()

	const ctx = getKnowContext()
	const slug = $derived(slugify(target))

	// Look up from the per-page resolved links map (populated server-side).
	// The server already resolves cross-domain fallthrough, so one lookup suffices.
	const resolved = $derived.by(() => {
		return ctx.resolvedLinks.get(`${ctx.sourceDomain}:${slug.toLowerCase()}`)
			?? { href: `${ctx.pageBaseUrl}/${slug}`, exists: false }
	})

	const href = $derived(resolved.href)
	const exists = $derived(resolved.exists)

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
		previewX = event.clientX
		previewY = event.clientY
	}

	function onMouseLeave() {
		clearTimeout(hoverTimeout)
		showPreview = false
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<a
	{href}
	class="know-link underline decoration-transparent hover:decoration-current transition-colors {exists ? 'text-link' : 'text-error-hover'}"
	title={exists && showPreview ? undefined : target}
	onmouseenter={onMouseEnter}
	onmousemove={onMouseMove}
	onmouseleave={onMouseLeave}
>{#if display}{#each display as child}<WikiNodeComponent node={child} />{/each}{:else}{target}{/if}</a>{#if showPreview}<LinkPreview {slug} x={previewX} y={previewY} />{/if}
