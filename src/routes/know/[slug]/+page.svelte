<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import Button from '$lib/components/ui/Button.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import KnowArticle from './KnowArticle.svelte'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>
	const deleteMutation = createMutation(() => ({
		mutationFn: () => api('DELETE', `/api/pages/${data.slug}`),
	}))

	const siteName = $derived($page.data.siteConfig?.siteName ?? 'KnowThing')
	const description = $derived(data.notFound ? '' : data.description)
	const ogImageUrl = $derived.by(() => {
		if (data.notFound || !data.card?.image) return null
		const base = `${$page.url.origin}/api/media/${encodeURIComponent(data.card.image)}`
		if (data.card.mimeType === 'image/svg+xml') {
			return data.card.hasRaster ? `${base}?raster=1` : null
		}
		return base
	})

	async function deletePage() {
		const ok = await confirmDialog.confirm(m.know_delete_page(), m.common_delete_confirm_named({ name: data.title }), m.common_delete(), m.common_cancel())
		if (!ok) return
		try {
			await deleteMutation.mutateAsync()
			pushSuccess(m.know_page_deleted({ name: data.title }))
			goto('/')
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.know_delete_failed())
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
				{m.know_article_not_exist()}
			</p>
			<Button href="/know/create?title={encodeURIComponent(data.title)}&slug={data.slug}" size="lg">
				{m.know_create_this_page()}
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
