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
		{ href: '/rodder/manage/sectors', label: 'Sectors', description: 'Frames and placement', icon: Compass },
		{ href: '/rodder/manage/registry', label: 'Registry', description: 'Hierarchy and records', icon: TreeStructure },
		{ href: '/rodder/manage/create', label: 'Create', description: 'Add rodder objects', icon: Plus },
	] as const
</script>

<svelte:head>
	<title>Rodder authoring — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={[{ label: 'Rodder', href: '/rodder' }, { label: 'Authoring' }]}
	title="Rodder authoring"
	subtitle="Shape the atlas from coordinate frame to orbiting body."
>
	{#snippet actions()}
		<a href={resolve('/rodder')} class="flex items-center gap-1 text-sm text-link transition-colors hover:text-link-hover">
			<ArrowLeft size={14} weight="bold" /> Back to atlas
		</a>
	{/snippet}

	<nav aria-label="Rodder authoring" class="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
