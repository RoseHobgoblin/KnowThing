<script lang="ts">
	import type { PageData } from './$types.js'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import LanguageCard from '$lib/feature/wordbook/public/ui/LanguageCard.svelte'
	import WordEntry from '$lib/feature/wordbook/public/ui/WordEntry.svelte'
	import { wordbookBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'
	import { createKnowContext } from '$lib/renderer/context.js'
	import Input from '$lib/components/ui/Input.svelte'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()

	const wbName = $derived($page.data.siteConfig?.wordbookName ?? 'Wordbook')
	const siteName = $derived($page.data.siteConfig?.siteName ?? 'KnowThing')
	const description = $derived(
		`${data.totalWords} ${data.totalWords === 1 ? 'word' : 'words'} across ${data.languages.length} ${data.languages.length === 1 ? 'language' : 'languages'}.`,
	)

	createKnowContext({
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: $page.data.calendarDate ?? null,
	})
</script>

<svelte:head>
	<title>{wbName} — {siteName}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content="{wbName} — {siteName}" />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={$page.url.href} />
	<meta property="og:site_name" content={siteName} />
</svelte:head>

<ArticleShell
	breadcrumbs={wordbookBreadcrumbs(wbName)}
	title={wbName}
>
	<p class="text-dim mb-4">
		{data.totalWords} {data.totalWords === 1 ? 'word' : 'words'} across {data.languages.length} {data.languages.length === 1 ? 'language' : 'languages'}
	</p>

	<form action="/search" method="GET" class="max-w-2xl mb-4 flex gap-2 flex-col sm:flex-row">
		<input type="hidden" name="scope" value="wordbook" />
		<div class="flex-1 flex gap-2">
			<Input
				type="text"
				name="q"
				placeholder={m.wb_search_placeholder()}
				class="flex-1 text-lg"
			/>
			{#if data.languages.length > 0}
				<select
					name="language"
					class="p-3 bg-page text-sm text-body focus:outline-none focus:ring-2 focus:ring-accent"
				>
					<option value="">{m.wb_all_languages()}</option>
					{#each data.languages as language (language.slug)}
						<option value={language.slug}>{language.name}</option>
					{/each}
				</select>
			{/if}
		</div>
		<button
			type="submit"
			class="px-6 py-3 bg-accent text-surface font-medium transition-colors text-sm hover:bg-accent-hover"
		>
			{m.common_search()}
		</button>
	</form>

	<div class="mb-6">
		<a href="/Wordbook/contribute" class="text-sm text-link hover:text-link-hover hover:underline">+ {m.wb_add_word()}</a>
	</div>

	<!-- Languages -->
	{#if data.languages.length > 0}
		<section class="mb-6">
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-lg font-semibold text-body">{m.wb_languages()}</h2>
				<a href="/Wordbook/contribute/language" class="text-sm text-link hover:text-link-hover hover:underline">+ {m.wb_add_language()}</a>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.languages as lang (lang.slug)}
					<LanguageCard
						name={lang.name}
						slug={lang.slug}
						nativeName={lang.nativeName}
						family={lang.family}
						script={lang.script}
						color={lang.color || 'var(--color-accent)'}
						wordCount={Number(lang.wordCount)}
					/>
				{/each}
			</div>
		</section>
	{:else}
		<div class="text-center py-12 text-secondary">
			<p class="text-lg mb-2">{m.wb_no_languages_yet()}</p>
			<p class="text-sm">
				<a href="/Wordbook/contribute/language" class="text-link hover:underline">{m.wb_add_a_language()}</a> {m.wb_to_get_started()}
			</p>
		</div>
	{/if}

	<!-- Recent -->
	{#if data.recent.length > 0}
		<section>
			<h2 class="text-lg font-semibold text-body mb-3">{m.wb_recently_added()}</h2>
			<div class="bg-raised divide-y divide-border-subtle">
				{#each data.recent as entry (entry.id)}
					<WordEntry {entry} />
				{/each}
			</div>
		</section>
	{/if}
</ArticleShell>
