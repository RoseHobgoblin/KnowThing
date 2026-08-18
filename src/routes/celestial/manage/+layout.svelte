<script lang="ts">
	import type { Snippet } from 'svelte'
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { cn } from '$lib/utils.js'
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
	import Compass from 'phosphor-svelte/lib/Compass'
	import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
	import Plus from 'phosphor-svelte/lib/Plus'

	let { children }: { children: Snippet } = $props()

	const nav = [
		{ href: '/celestial/manage/sectors', label: 'Sectors', description: 'Frames and placement', icon: Compass },
		{ href: '/celestial/manage/registry', label: 'Registry', description: 'Hierarchy and records', icon: TreeStructure },
		{ href: '/celestial/manage/create', label: 'Create', description: 'Add celestial objects', icon: Plus },
	] as const
</script>

<svelte:head>
	<title>Celestial authoring — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={[{ label: 'Celestial', href: '/celestial' }, { label: 'Authoring' }]}
	title="Celestial authoring"
	subtitle="Shape the atlas from coordinate frame to orbiting body."
>
	{#snippet actions()}
		<a href={resolve('/celestial')} class="flex items-center gap-1 text-sm text-link transition-colors hover:text-link-hover">
			<ArrowLeft size={14} weight="bold" /> Back to atlas
		</a>
	{/snippet}

	<nav aria-label="Celestial authoring" class="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
		{#each nav as item (item.href)}
			<a
				href={resolve(item.href)}
				aria-current={$page.url.pathname === item.href ? 'page' : undefined}
				class={cn(
					'flex items-center gap-3 border px-4 py-3 transition-colors',
					$page.url.pathname === item.href
						? 'border-accent-border bg-accent-subtle text-heading'
						: 'border-border-subtle bg-surface text-secondary hover:bg-raised hover:text-heading',
				)}
			>
				<item.icon size={20} weight={$page.url.pathname === item.href ? 'fill' : 'regular'} class="shrink-0 text-accent" />
				<span class="min-w-0">
					<span class="block text-sm font-semibold">{item.label}</span>
					<span class="block text-xs text-secondary">{item.description}</span>
				</span>
			</a>
		{/each}
	</nav>

	{@render children()}
</ArticleShell>
