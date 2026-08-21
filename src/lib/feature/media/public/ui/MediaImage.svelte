<script lang="ts">
	import { mediaLightbox } from './mediaLightbox.svelte.ts'
	import { mediaContentUrl } from '../media-urls.js'

	let {
		filename,
		alt = '',
		caption = '',
		displayWidth,
		sizes,
		class: className = '',
		loading = 'lazy',
		linkable = true,
	}: {
		filename: string
		alt?: string
		caption?: string
		displayWidth?: number
		sizes?: string
		class?: string
		loading?: 'eager' | 'lazy'
		linkable?: boolean
	} = $props()

	const encodedFilename = $derived(encodeURIComponent(filename))
	const baseUrl = $derived(mediaContentUrl(filename))
	const srcset = $derived(`${baseUrl}?w=150 150w, ${baseUrl}?w=300 300w, ${baseUrl}?w=600 600w`)
	const source = $derived.by(() => {
		if (!displayWidth) return `${baseUrl}?w=600`
		if (displayWidth <= 150) return `${baseUrl}?w=150`
		if (displayWidth <= 300) return `${baseUrl}?w=300`
		if (displayWidth <= 600) return `${baseUrl}?w=600`
		return baseUrl
	})
	const resolvedSizes = $derived(
		sizes ?? (displayWidth ? `${displayWidth}px` : '(max-width: 640px) calc(100vw - 3rem), 600px'),
	)

	let anchorElement = $state<HTMLAnchorElement>()

	// Register this image in the gallery so the lightbox can step prev/next
	// through every linkable image on the page, ordered by document position.
	$effect(() => {
		if (!linkable || !anchorElement) return
		const element = anchorElement
		mediaLightbox.register({ filename, alt, caption, el: element })
		return () => mediaLightbox.unregister(element)
	})

	function onclick(event: MouseEvent) {
		if (event.button !== 0 || event.ctrlKey || event.shiftKey || event.metaKey || event.altKey) return
		event.preventDefault()
		mediaLightbox.open(filename, alt, caption)
	}
</script>

{#if linkable}
	<a
		bind:this={anchorElement}
		href="/media/{encodedFilename}"
		{onclick}
		class="contents"
		data-caption={caption}
	>
		<img
			src={source}
			srcset={srcset}
			sizes={resolvedSizes}
			{alt}
			{loading}
			decoding="async"
			class={className}
		/>
	</a>
{:else}
	<img
		src={source}
		srcset={srcset}
		sizes={resolvedSizes}
		{alt}
		{loading}
		decoding="async"
		class={className}
	/>
{/if}
