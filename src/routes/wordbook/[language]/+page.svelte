<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import AlphabetNav from '$lib/components/wordbook/AlphabetNav.svelte'
	import WordEntry from '$lib/components/wordbook/WordEntry.svelte'
	import InflectionSummary from '$lib/components/wordbook/InflectionSummary.svelte'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'

	let { data }: { data: PageData } = $props()

	const layoutData = $derived($page.data)
	const permissions = $derived(layoutData.permissions)
	const isAuthenticated = $derived(permissions.isAuthenticated)
	const canManageWordbook = $derived(permissions.canManageWordbook)
	const wbName = $derived(layoutData.siteConfig?.wordbookName ?? 'Wordbook')
	const siteName = $derived(layoutData.siteConfig?.siteName ?? 'KnowThing')
	const description = $derived(
		data.language.description
		|| `${Number(data.language.wordCount)} ${Number(data.language.wordCount) === 1 ? 'word' : 'words'} in ${data.language.name}.`,
	)

	createKnowContext({
		resolvedLinks: new Map(Object.entries(data.resolvedLinks ?? {})),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/Wordbook',
		sourceDomain: 'wordbook',
		calendarDate: $page.data.calendarDate ?? null,
		structuredCollections: data.structuredCollections ?? null,
	})

	// Group entries by accent-folded first grapheme (matches the server's
	// unaccent bucketing): "é" → E, digraph-safe via Intl.Segmenter, and
	// anything non-alphabetic lands in '#'.
	const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
	function letterBucket(word: string): string {
		const iterated = segmenter.segment(word.trim())[Symbol.iterator]().next()
		if (iterated.done) return '#'
		const grapheme = iterated.value.segment
		const folded = grapheme.normalize('NFD').replaceAll(/\p{M}/gu, '') || grapheme
		const upper = folded.toLocaleUpperCase()
		return /\p{L}/u.test(upper) ? upper : '#'
	}

	function groupByLetter(entries: typeof data.entries) {
		const groups: Record<string, typeof entries> = {}
		for (const entry of entries) {
			const letter = letterBucket(entry.word)
			if (!groups[letter]) groups[letter] = []
			groups[letter].push(entry)
		}
		// '#' (non-alphabetic) sorts last, letters by locale order.
		return Object.entries(groups).toSorted(([a], [b]) => {
			if (a === '#') return 1
			if (b === '#') return -1
			return a.localeCompare(b)
		})
	}

	const grouped = $derived(groupByLetter(data.entries))
	const totalPages = $derived(Math.max(1, Math.ceil(data.entriesTotal / data.entriesPageSize)))
	function pageHref(page: number) {
		const parts: string[] = []
		if (data.currentLetter) parts.push(`letter=${encodeURIComponent(data.currentLetter)}`)
		if (page > 1) parts.push(`page=${page}`)
		return `/Wordbook/${data.language.slug}${parts.length > 0 ? `?${parts.join('&')}` : ''}`
	}

	// Build breadcrumbs from ancestry chain
	const breadcrumbs = $derived([
		{ label: wbName, href: '/Wordbook' },
		...data.ancestryChain.slice(0, -1).map((a: any) => ({ label: a.name, href: `/Wordbook/${a.slug}` })),
		{ label: data.language.name },
	])
</script>

<svelte:head>
	<title>{data.language.name} — {wbName} — {siteName}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content="{data.language.name} — {wbName} — {siteName}" />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={$page.url.href} />
	<meta property="og:site_name" content={siteName} />
</svelte:head>

<ArticleShell
	{breadcrumbs}
	title={data.language.name}
>
	{#snippet actions()}
		{#if canManageWordbook}
			<a href="/Wordbook/contribute?language={data.language.slug}" class="text-sm text-link hover:text-link-hover hover:underline">+ Add word</a>
			<a href="/Wordbook/contribute/language/{data.language.slug}" class="text-sm text-faint hover:text-link hover:underline">Edit language</a>
		{:else if isAuthenticated}
			<span class="text-faint text-sm">View only. Editor role required for wordbook changes.</span>
		{/if}
	{/snippet}

	{#snippet badges()}
		<div class="flex items-center gap-3 text-sm text-dim mt-1">
			{#if data.language.nativeName}
				<span class="italic">{data.language.nativeName}</span>
				<span class="text-faint">·</span>
			{/if}
			{#if data.language.family}
				<span>{data.language.family}</span>
			{/if}
			{#if data.language.script}
				<span class="text-faint">·</span>
				<span>{data.language.script} script</span>
			{/if}
			<span class="text-faint">·</span>
			<span style="color: {data.language.color};" class="font-medium">{Number(data.language.wordCount)} words</span>
		</div>
	{/snippet}

	{#if data.language.description}
		<p class="text-secondary leading-relaxed mb-4">{data.language.description}</p>
	{/if}

	{#if data.language.pageSlug}
		<a
			href="/know/{data.language.pageSlug}"
			class="inline-block mb-4 text-sm text-link hover:text-link-hover hover:underline"
		>Read the full article →</a>
	{/if}

	<!--
		Wiki body: prose + {{Consonants}}/{{Vowels}}/{{Orthography}} grids render
		right here — no more entering data that only a Know article could display.
	-->
	{#if data.bodyAst}
		<article class="know-article mb-6">
			<WikiNodeComponent node={data.bodyAst} />
		</article>
	{/if}

	<!-- Child languages -->
	{#if data.children.length > 0}
		<div class="bg-raised border border-border-subtle p-4 mb-4">
			<h3 class="text-sm font-semibold text-body mb-2">Descendant languages</h3>
			<div class="flex flex-wrap gap-2">
				{#each data.children as child}
					<a href="/Wordbook/{child.slug}" class="
						inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm
						transition-colors
						hover:border-accent-border hover:bg-accent-subtle
					">
						<span class="size-2" style="background-color: {child.color || 'var(--color-accent)'}"></span>
						<span class="font-medium text-body">{child.name}</span>
						{#if child.nativeName}
							<span class="text-faint text-xs italic">{child.nativeName}</span>
						{/if}
						{#if child.languageType !== 'language'}
							<span class="text-xs text-faint">({child.languageType})</span>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Dialects -->
	{#if data.dialects.length > 0}
		<div class="bg-raised border border-border-subtle p-4 mb-4">
			<h3 class="text-sm font-semibold text-body mb-2">Dialects</h3>
			<div class="space-y-1">
				{#each data.dialects as dialect}
					<div class="flex items-center gap-2 text-sm">
						<span class="font-medium text-secondary">{dialect.name}</span>
						{#if dialect.region}
							<span class="text-faint text-xs">({dialect.region})</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Inflection system (read-only summary) -->
	{#if data.inflectionDimensions.length > 0 || canManageWordbook}
		<div class="mb-4">
			<InflectionSummary
				languageSlug={data.language.slug}
				dimensions={data.inflectionDimensions}
				classes={data.paradigmClasses}
				canEdit={canManageWordbook}
			/>
		</div>
	{/if}

	<!-- Alphabet nav -->
	<div class="border border-border-subtle bg-raised px-2 mb-4">
		<AlphabetNav
			activeLetters={data.activeLetters}
			currentLetter={data.currentLetter}
			baseUrl="/Wordbook/{data.language.slug}"
		/>
	</div>

	<!-- Entries -->
	{#if data.entries.length > 0}
		{#each grouped as [letter, entries]}
			<section class="mb-4">
				<h2 class="text-xl font-bold text-faint mb-2 pl-1" id="letter-{letter}">{letter}</h2>
				<div class="bg-raised border border-border-subtle divide-y divide-border-subtle">
					{#each entries as entry}
						<WordEntry {entry} showLanguage={false} />
					{/each}
				</div>
			</section>
		{/each}

		{#if totalPages > 1}
			<nav class="flex items-center justify-center gap-3 text-sm mb-4" aria-label="Entry pages">
				{#if data.entriesPage > 1}
					<a href={pageHref(data.entriesPage - 1)} class="text-link hover:text-link-hover hover:underline">← Previous</a>
				{/if}
				<span class="text-dim">
					Page {data.entriesPage} of {totalPages}
					<span class="text-faint">({data.entriesTotal} words)</span>
				</span>
				{#if data.entriesPage < totalPages}
					<a href={pageHref(data.entriesPage + 1)} class="text-link hover:text-link-hover hover:underline">Next →</a>
				{/if}
			</nav>
		{/if}
	{:else}
		<div class="text-center py-12 text-faint">
			{#if data.currentLetter}
				<p>No words starting with "{data.currentLetter.toUpperCase()}"</p>
			{:else}
				<p class="text-lg mb-2">No words yet</p>
				{#if canManageWordbook}
					<p class="text-sm">
						<a href="/Wordbook/contribute?language={data.language.slug}" class="text-link hover:underline">Add the first word</a>
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</ArticleShell>
