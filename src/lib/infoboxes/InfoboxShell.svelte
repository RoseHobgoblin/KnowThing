<script lang="ts">
	import type { Snippet } from 'svelte'
	import MediaImage from '$lib/components/MediaImage.svelte'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let {
		title = '',
		subtitle = '',
		image = '',
		imageCaption = '',
		children,
	}: {
		title?: string
		subtitle?: string
		image?: string
		imageCaption?: string
		children: Snippet
	} = $props()
</script>

<aside class="know-infobox">
	{#if title}
		<div class="infobox-header">
			<h2 class="infobox-title"><InlineMarkup text={title} /></h2>
			{#if subtitle}
				<div class="infobox-subtitle"><InlineMarkup text={subtitle} /></div>
			{/if}
		</div>
	{/if}
	{#if image}
		<div class="infobox-media">
			<MediaImage
				filename={image}
				alt={imageCaption || image}
				caption={imageCaption}
				displayWidth={320}
				sizes="(max-width: 640px) calc(100vw - 3rem), 320px"
				class="max-w-full h-auto mx-auto"
			/>
		</div>
		{#if imageCaption}
			<div class="infobox-caption"><InlineMarkup text={imageCaption} /></div>
		{/if}
	{/if}
	{@render children()}
</aside>
