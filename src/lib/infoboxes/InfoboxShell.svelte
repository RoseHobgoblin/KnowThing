<script lang="ts">
	import type { Snippet } from 'svelte'
	import MediaImage from '$lib/components/MediaImage.svelte'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let {
		image = '',
		imageCaption = '',
		children,
	}: {
		image?: string
		imageCaption?: string
		children: Snippet
	} = $props()
</script>

<aside class="know-infobox">
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
			{#if imageCaption}
				<div class="infobox-caption"><InlineMarkup text={imageCaption} /></div>
			{/if}
		</div>
	{/if}
	{@render children()}
</aside>
