<script lang="ts">
	import type { Snippet } from 'svelte'

	let {
		breadcrumbs = [],
		title,
		actions,
		badges,
		footer,
		children,
	}: {
		breadcrumbs?: { label: string, href?: string }[]
		title: string
		actions?: Snippet
		badges?: Snippet
		footer?: Snippet
		children: Snippet
	} = $props()

	const currentCrumb = breadcrumbs.at(-1)
	const parentCrumbs = breadcrumbs.slice(0, -1)
</script>

<div class="bg-surface shadow-sm border border-border overflow-hidden">
	<!-- Header -->
	<div class="px-4 pt-4 md:px-6">
		{#if breadcrumbs.length > 0}
			<div class="text-[10px] font-semibold uppercase tracking-wider mb-1">
				{#each parentCrumbs as crumb, i (i)}
					{#if i > 0}
						<span class="text-faint"> / </span>
					{/if}
					{#if crumb.href}
						<a href={crumb.href} class="text-link transition-colors hover:text-link-hover">{crumb.label}</a>
					{:else}
						<span class="text-faint">{crumb.label}</span>
					{/if}
				{/each}
				{#if parentCrumbs.length > 0}
					<span class="text-faint"> / </span>
				{/if}
				<span class="text-accent">{currentCrumb?.label ?? title}</span>
			</div>
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
