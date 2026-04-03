<script lang="ts">
	let {
		filename,
		alt = '',
		displayWidth,
		sizes,
		class: className = '',
		loading = 'lazy',
	}: {
		filename: string
		alt?: string
		displayWidth?: number
		sizes?: string
		class?: string
		loading?: 'eager' | 'lazy'
	} = $props()

	const encodedFilename = $derived(encodeURIComponent(filename))
	const baseUrl = $derived(`/api/media/${encodedFilename}`)
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
</script>

<img
	src={source}
	srcset={srcset}
	sizes={resolvedSizes}
	{alt}
	{loading}
	decoding="async"
	class={className}
/>
