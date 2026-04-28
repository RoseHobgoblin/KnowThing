<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import GraphemeEditor from '$lib/components/phonology/GraphemeEditor.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'

	let { data }: { data: PageData } = $props()

	const layoutData = $derived($page.data)
	const permissions = $derived(layoutData.permissions)
	const canManageWordbook = $derived(permissions?.canManageWordbook ?? false)
	const wbName = $derived(layoutData.siteConfig?.wordbookName ?? 'Wordbook')
	const siteName = $derived(layoutData.siteConfig?.siteName ?? 'KnowThing')

	createKnowContext({
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: $page.data.calendarDate ?? null,
	})

	const breadcrumbs = $derived([
		{ label: wbName, href: '/wordbook' },
		...data.ancestryChain.slice(0, -1).map((a: any) => ({ label: a.name, href: `/wordbook/${a.slug}` })),
		{ label: data.language.name, href: `/wordbook/${data.language.slug}` },
		{ label: 'Orthography' },
	])

	const description = $derived(
		`Orthography for ${data.language.name}: ${data.inventory.length} ${data.inventory.length === 1 ? 'grapheme' : 'graphemes'}.`,
	)
</script>

<svelte:head>
	<title>Orthography — {data.language.name} — {wbName} — {siteName}</title>
	<meta name="description" content={description} />
</svelte:head>

<ArticleShell {breadcrumbs} title="Orthography">
	{#snippet badges()}
		<div class="flex flex-wrap items-center gap-3 text-sm text-dim mt-1">
			<span style="color: {data.language.color};" class="font-medium">{data.language.name}</span>
			{#if data.language.nativeName}
				<span class="text-faint">·</span>
				<span class="italic">{data.language.nativeName}</span>
			{/if}
			<span class="text-faint">·</span>
			<span>{data.inventory.length} {data.inventory.length === 1 ? 'grapheme' : 'graphemes'}</span>
		</div>
	{/snippet}

	{#snippet actions()}
		<a href="/wordbook/{data.language.slug}/phonology" class="text-sm text-faint hover:text-link hover:underline">Phonology</a>
		<a href="/wordbook/{data.language.slug}" class="text-sm text-link hover:text-link-hover hover:underline">← Back to {data.language.name}</a>
	{/snippet}

	<p class="text-secondary leading-relaxed mb-2">
		Map {data.language.name}'s graphemes to their phonemes. Reference this table from any wiki page with
		<code class="text-accent text-xs bg-muted px-1 py-0.5">&#123;&#123;orthography|{data.language.slug}&#125;&#125;</code>.
	</p>
	<p class="text-dim text-xs mb-6">
		This is <em>documentation</em>, not a live transliterator — the template renders the mapping, it doesn't convert text.
	</p>

	<GraphemeEditor
		languageSlug={data.language.slug}
		initial={data.inventory}
		phonemeInventory={data.phonemeInventory}
		readOnly={!canManageWordbook}
	/>
</ArticleShell>
