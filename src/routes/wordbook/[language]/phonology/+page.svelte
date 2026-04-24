<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import PhonemeEditor from '$lib/components/phonology/PhonemeEditor.svelte'
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

	const consonantCount = $derived(data.inventory.filter((p: any) => p.type === 'consonant').length)
	const vowelCount = $derived(data.inventory.filter((p: any) => p.type === 'vowel').length)
	const otherCount = $derived(data.inventory.length - consonantCount - vowelCount)

	const breadcrumbs = $derived([
		{ label: wbName, href: '/wordbook' },
		...data.ancestryChain.slice(0, -1).map((a: any) => ({ label: a.name, href: `/wordbook/${a.slug}` })),
		{ label: data.language.name, href: `/wordbook/${data.language.slug}` },
		{ label: 'Phonology' },
	])

	const description = $derived(
		`Phoneme inventory for ${data.language.name}: ${consonantCount} consonants, ${vowelCount} vowels.`,
	)
</script>

<svelte:head>
	<title>Phonology — {data.language.name} — {wbName} — {siteName}</title>
	<meta name="description" content={description} />
</svelte:head>

<ArticleShell {breadcrumbs} title="Phonology">
	{#snippet badges()}
		<div class="flex flex-wrap items-center gap-3 text-sm text-dim mt-1">
			<span style="color: {data.language.color};" class="font-medium">{data.language.name}</span>
			{#if data.language.nativeName}
				<span class="text-faint">·</span>
				<span class="italic">{data.language.nativeName}</span>
			{/if}
			<span class="text-faint">·</span>
			<span>{consonantCount} {consonantCount === 1 ? 'consonant' : 'consonants'}</span>
			<span class="text-faint">·</span>
			<span>{vowelCount} {vowelCount === 1 ? 'vowel' : 'vowels'}</span>
			{#if otherCount > 0}
				<span class="text-faint">·</span>
				<span>{otherCount} other</span>
			{/if}
		</div>
	{/snippet}

	{#snippet actions()}
		<a href="/wordbook/{data.language.slug}" class="text-sm text-link hover:text-link-hover hover:underline">← Back to {data.language.name}</a>
	{/snippet}

	<p class="text-secondary leading-relaxed mb-6">
		Define the sound inventory for {data.language.name}. Reference it from any wiki page with
		<code class="text-accent text-xs bg-muted px-1 py-0.5">&#123;&#123;consonants|{data.language.slug}&#125;&#125;</code>,
		<code class="text-accent text-xs bg-muted px-1 py-0.5">&#123;&#123;vowels|{data.language.slug}&#125;&#125;</code>, or
		<code class="text-accent text-xs bg-muted px-1 py-0.5">&#123;&#123;phonology|{data.language.slug}&#125;&#125;</code>.
	</p>

	<PhonemeEditor
		languageSlug={data.language.slug}
		initial={data.inventory}
		readOnly={!canManageWordbook}
	/>
</ArticleShell>
