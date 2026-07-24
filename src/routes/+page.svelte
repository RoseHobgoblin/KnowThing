<script lang="ts">
	import type { PageData } from './$types.js'
	import { page } from '$app/stores'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
	const sc = $derived($page.data.siteConfig)
</script>

<svelte:head>
	<title>{sc?.siteName ?? 'KnowThing'}</title>
	<meta name="description" content={sc?.siteTagline ?? 'A collaborative encyclopedia'} />
	<meta property="og:title" content={sc?.siteName ?? 'KnowThing'} />
	<meta property="og:description" content={sc?.siteTagline ?? 'A collaborative encyclopedia'} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={$page.url.href} />
	<meta property="og:site_name" content={sc?.siteName ?? 'KnowThing'} />
</svelte:head>

<div class="mx-auto max-w-5xl space-y-5 py-3 md:py-6">
	<header class="border-b border-border-subtle pb-3 text-center">
		<h1 class="font-serif text-3xl font-bold text-heading md:text-4xl">{sc?.siteName ?? 'KnowThing'}</h1>
		<p class="mt-1 text-xs italic text-secondary md:text-sm">
			{sc?.siteTagline ?? 'A collaborative encyclopedia'}{sc?.institutionName ? ` · maintained by ${sc.institutionName}` : ''}
		</p>
		<div class="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs font-medium uppercase tracking-wider text-secondary">
			{#each [
				{ label: m.home_stat_articles(), value: data.stats.articles },
				{ label: m.home_stat_words(), value: data.stats.words },
				{ label: m.home_stat_languages(), value: data.stats.languages },
				{ label: m.home_stat_media(), value: data.stats.media },
				{ label: m.home_stat_contributors(), value: data.stats.users },
			] as stat (stat.label)}
				<span><strong class="text-heading">{stat.value.toLocaleString()}</strong> {stat.label}</span>
			{/each}
		</div>
	</header>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-12">
		<div class="space-y-4 md:col-span-8">
			{#if data.featured}
				<article class="bg-surface">
					{#if data.featured.image}
						<a href="/know/{data.featured.slug}" class="block overflow-hidden">
							<img src="/api/media/{encodeURIComponent(data.featured.image)}?w=600" alt="" class="h-52 w-full object-cover md:h-64" />
						</a>
					{/if}
					<div class="p-4 md:p-5">
						<div class="mb-1 text-xs font-semibold uppercase tracking-wider text-secondary">{m.home_featured_article()}</div>
						<h2 class="font-serif text-xl font-bold text-heading md:text-2xl">
							<a href="/know/{data.featured.slug}" class="transition-colors hover:text-link">{data.featured.title}</a>
						</h2>
						{#if data.featured.summary}
							<p class="mt-2 text-sm/relaxed text-body">{data.featured.summary}</p>
						{/if}
						<a href="/know/{data.featured.slug}" class="mt-3 inline-block text-xs text-link transition-colors hover:text-link-hover">{m.home_read_more()}</a>
					</div>
				</article>
			{:else}
				<div class="bg-surface p-6">
					<div class="text-xs font-semibold uppercase tracking-wider text-secondary">{m.home_get_started()}</div>
					<p class="mt-2 text-sm text-dim">{m.home_no_articles()}</p>
					<a href="/know/create" class="mt-4 inline-block bg-accent px-5 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover">{m.home_create_page()}</a>
				</div>
			{/if}

			{#if data.recentEdits.length > 0}
				<section class="bg-surface">
					<div class="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
						<h2 class="text-xs font-semibold uppercase tracking-wider text-secondary">{m.home_recent_changes()}</h2>
						<a href="/dashboard/recent" class="text-xs text-link transition-colors hover:text-link-hover">{m.common_view_all()}</a>
					</div>
					<div class="divide-y divide-border-subtle">
						{#each data.recentEdits.slice(0, 5) as edit (edit.createdAt)}
							<div class="flex items-center justify-between gap-4 px-4 py-2 text-xs">
								<div class="min-w-0">
									<a href="/know/{edit.pageSlug}" class="font-medium text-link transition-colors hover:text-link-hover">{edit.title}</a>
									{#if edit.editSummary}<span class="ml-2 text-xs text-dim">{edit.editSummary}</span>{/if}
								</div>
								<time class="shrink-0 text-xs text-dim">{new Date(edit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</div>

		<aside class="space-y-4 md:col-span-4">
			{#if data.randomWord}
				<a href="/Wordbook/{data.randomWord.languageSlug}/{encodeURIComponent(data.randomWord.word)}" class="interactive-frame block bg-surface p-4 transition-colors group">
					<div class="text-xs font-semibold uppercase tracking-wider text-secondary">{m.home_from_wordbook({ name: sc?.wordbookName ?? 'Wordbook' })}</div>
					<div class="mt-2 flex items-baseline gap-2">
						<span class="font-serif text-lg font-bold text-heading transition-colors group-hover:text-link">{data.randomWord.word}</span>
						{#if data.randomWord.pronunciation}<span class="font-mono text-xs text-secondary">· {data.randomWord.pronunciation}</span>{/if}
					</div>
					<div class="text-xs uppercase tracking-wide text-dim">{data.randomWord.languageName}</div>
					{#if data.randomWord.definition}<p class="mt-3 text-xs/relaxed text-body">{data.randomWord.definition}</p>{/if}
				</a>
			{/if}

			{#if data.calendarInfo}
				<a href="/calendar" class="interactive-frame block bg-surface p-4 transition-colors group">
					<div class="text-xs font-semibold uppercase tracking-wider text-secondary">{m.home_on_this_day({ name: data.calendarInfo.name })}</div>
					<div class="mt-2 font-serif text-lg italic text-heading transition-colors group-hover:text-link">{data.calendarInfo.day} {data.calendarInfo.monthName}</div>
					<div class="text-xs text-body">{data.calendarInfo.dayName}, {data.calendarInfo.yearDisplay}</div>
					{#if data.calendarInfo.seasonName}<div class="mt-1 text-xs text-dim">{data.calendarInfo.seasonName}</div>{/if}
				</a>
			{/if}

			<nav>
				<div class="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary">{m.home_explore()}</div>
				<div class="flex flex-wrap gap-1.5">
					<a href="/special/categories" class="px-2 py-1 text-xs text-secondary hover:text-link">{m.nav_categories()}</a>
					<a href="/worldmap" class="px-2 py-1 text-xs text-secondary hover:text-link">{m.home_explore_maps()}</a>
					<a href="/celestial" class="px-2 py-1 text-xs text-secondary hover:text-link">{m.nav_celestial()}</a>
					<a href="/Wordbook" class="px-2 py-1 text-xs text-secondary hover:text-link">{m.home_stat_languages()}</a>
				</div>
			</nav>
		</aside>
	</div>
</div>
