<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { Breadcrumb } from '$lib/utils/breadcrumbs.js'
	import { breadcrumbJsonLd } from '$lib/utils/breadcrumbs.js'
	import { page } from '$app/stores'
	import HouseIcon from 'phosphor-svelte/lib/HouseIcon'

	let {
		breadcrumbs = [],
		title,
		actions,
		badges,
		footer,
		children,
	}: {
		breadcrumbs?: Breadcrumb[]
		title: string
		actions?: Snippet
		badges?: Snippet
		footer?: Snippet
		children: Snippet
	} = $props()

	const sc = $derived($page.data.siteConfig)
	const rootLabel = $derived(sc?.navWikiLabel ?? 'Main Page')

	const currentCrumb = $derived(breadcrumbs.at(-1))
	const parentCrumbs = $derived(breadcrumbs.slice(0, -1))
	const currentLabel = $derived(currentCrumb?.label ?? title)
	const currentColon = $derived(currentCrumb?.namespaceHref ? currentLabel.indexOf(':') : -1)

	const jsonLd = $derived(
		breadcrumbs.length > 0
			? JSON.stringify(breadcrumbJsonLd(rootLabel, breadcrumbs))
			: null,
	)
</script>

<svelte:head>
	{#if jsonLd}
		{@html `<script type="application/ld+json">${jsonLd}</script>`}
	{/if}
</svelte:head>

<div class="bg-surface shadow-sm border border-border overflow-hidden">
	<!-- Header -->
	<div class="px-4 pt-4 md:px-6">
		{#if breadcrumbs.length > 0}
			<nav aria-label="Breadcrumb">
				<ol class="flex flex-wrap items-center text-xs font-semibold uppercase tracking-wider mb-1">
					<li>
						<a href="/" aria-label={rootLabel} class="text-link transition-colors hover:text-link-hover inline-flex items-center"><HouseIcon weight="fill"/></a>
					</li>
					{#each parentCrumbs as crumb (crumb.label)}
						{@const colon = crumb.namespaceHref ? crumb.label.indexOf(':') : -1}
						<li class="flex items-center">
							<span class="text-faint mx-1" aria-hidden="true">/</span>
							{#if colon > 0}
								<a href={crumb.namespaceHref} class="text-link transition-colors hover:text-link-hover">{crumb.label.slice(0, colon)}</a><span class="text-faint">{crumb.label.slice(colon)}</span>
							{:else if crumb.href}
								<a href={crumb.href} class="text-link transition-colors hover:text-link-hover">{crumb.label}</a>
							{:else}
								<span class="text-faint">{crumb.label}</span>
							{/if}
						</li>
					{/each}
					<li class="flex items-center" aria-current="page">
						<span class="text-faint mx-1" aria-hidden="true">/</span>
						{#if currentColon > 0 && currentCrumb}
							<a href={currentCrumb.namespaceHref} class="text-link transition-colors hover:text-link-hover">{currentLabel.slice(0, currentColon)}</a><span class="text-accent">{currentLabel.slice(currentColon)}</span>
						{:else}
							<span class="text-accent">{currentLabel}</span>
						{/if}
					</li>
				</ol>
			</nav>
		{/if}

		<div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
			<h1 class="text-2xl font-bold text-heading md:text-3xl">{title}</h1>
			{#if actions}
				<div class="flex gap-3 text-sm md:gap-4">
					{@render actions()}
				</div>
			{/if}
		</div>

		{#if badges}
			{@render badges()}
		{/if}

		<div class="mt-2 h-0.5 bg-linear-to-r from-accent to-accent-hover"></div>
	</div>

	<!-- Body -->
	<div class="px-4 pt-3 pb-4 md:px-6 md:pb-5">
		{@render children()}
	</div>

	<!-- Footer -->
	{#if footer}
		<div class="px-4 pb-4 md:px-6">
			{@render footer()}
		</div>
	{/if}
</div>
