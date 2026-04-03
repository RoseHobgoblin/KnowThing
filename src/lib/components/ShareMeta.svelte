<script lang="ts">
	import { page } from '$app/stores'

	let {
		title,
		description = '',
		type = 'website',
	}: {
		title: string
		description?: string
		type?: 'article' | 'website'
	} = $props()

	const sc = $derived($page.data.siteConfig)
	const siteName = $derived(sc?.siteName ?? 'KnowThing')
	const pageUrl = $derived($page.url.href)
	const cleanDescription = $derived(description.trim())
	const resolvedImageUrl = $derived.by(() => {
		if (!sc?.logoUrl) return ''
		try {
			return new URL(sc.logoUrl, $page.url).href
		} catch {
			return ''
		}
	})
</script>

<svelte:head>
	<link rel="canonical" href={pageUrl} />
	{#if cleanDescription}
		<meta name="description" content={cleanDescription} />
	{/if}
	<meta property="og:title" content={title} />
	{#if cleanDescription}
		<meta property="og:description" content={cleanDescription} />
	{/if}
	<meta property="og:type" content={type} />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:site_name" content={siteName} />
	{#if resolvedImageUrl}
		<meta property="og:image" content={resolvedImageUrl} />
		<meta property="og:image:alt" content={title} />
	{/if}
	<meta name="twitter:card" content={resolvedImageUrl ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={title} />
	{#if cleanDescription}
		<meta name="twitter:description" content={cleanDescription} />
	{/if}
	{#if resolvedImageUrl}
		<meta name="twitter:image" content={resolvedImageUrl} />
	{/if}
</svelte:head>
