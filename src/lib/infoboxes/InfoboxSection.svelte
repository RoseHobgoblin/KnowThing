<script lang="ts">
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'
	import type { Snippet } from 'svelte'

	let { title, variant = 'plain', children }: { title?: string, variant?: 'plain' | 'raised', children: Snippet } = $props()
</script>

<section class:infobox-section-raised={variant === 'raised'} class="infobox-section">
	{#if title}
		<h3 class="infobox-section-title"><InlineMarkup text={title} /></h3>
	{/if}
	<div class="infobox-section-rows">{@render children()}</div>
</section>
