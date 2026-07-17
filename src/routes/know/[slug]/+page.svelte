<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import Button from '$lib/components/ui/Button.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import KnowArticle from './KnowArticle.svelte'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const siteName = $derived($page.data.siteConfig?.siteName ?? 'KnowThing')
	const description = $derived(!data.notFound ? data.description : '')
	const ogImageUrl = $derived.by(() => {
		if (data.notFound || !data.card?.image) return null
		const base = `${$page.url.origin}/api/media/${encodeURIComponent(data.card.image)}`
		if (data.card.mimeType === 'image/svg+xml') {
			return data.card.hasRaster ? `${base}?raster=1` : null
		}
		return base
	})

	async function deletePage() {
		const ok = await confirmDialog.confirm('Delete page', `Delete "${data.title}"? This cannot be undone.`, 'Delete', 'Cancel')
		if (!ok) return
		const response = await fetch(`/api/pages/${data.slug}`, { method: 'DELETE' })
		if (response.ok) {
			pushSuccess(`"${data.title}" deleted`)
			goto('/')
		} else {
			pushError('Failed to delete page')
		}
	}
</script>

<svelte:head>
	<title>{data.title} — {siteName}</title>
	{#if !data.notFound}
		<meta name="description" content={description} />
		<meta property="og:title" content="{data.title} — {siteName}" />
		<meta property="og:description" content={description} />
		<meta property="og:type" content="article" />
		<meta property="og:url" content={$page.url.href} />
		<meta property="og:site_name" content={siteName} />
		{#if ogImageUrl}
			<meta property="og:image" content={ogImageUrl} />
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:image" content={ogImageUrl} />
		{:else}
			<meta name="twitter:card" content="summary" />
		{/if}
	{/if}
</svelte:head>

{#key data.slug}
	{#if data.notFound}
		<div class="bg-surface shadow-sm p-8 text-center">
			<h1 class="text-2xl font-bold mb-3 text-body">{data.title}</h1>
			<p class="text-dim mb-6">
				This article doesn't exist yet.
			</p>
			<Button href="/know/create?title={encodeURIComponent(data.title)}&slug={data.slug}" size="lg">
				Create this page
			</Button>
		</div>
	{:else if data.ast}
		<KnowArticle
			title={data.title}
			slug={data.slug}
			ast={data.ast}
			categories={data.categories}
			updatedAt={data.updatedAt}
			wordbookMatch={data.wordbookMatch}
			languageMatch={data.languageMatch}
			structuredData={data.structuredData ?? null}
			structuredCollections={data.structuredCollections ?? null}
			systemMaps={data.systemMaps ?? null}
			resolvedLinks={data.resolvedLinks ?? null}
			ondeletepage={deletePage}
		/>
	{/if}
{/key}

<ConfirmDialog bind:this={confirmDialog} />
