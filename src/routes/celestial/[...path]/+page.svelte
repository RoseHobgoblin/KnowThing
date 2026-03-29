<script lang="ts">
	import type { PageData } from './$types.js'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
	import { page } from '$app/stores'
	import InfoboxStar from '$lib/infoboxes/InfoboxStar.svelte'
	import InfoboxPlanet from '$lib/infoboxes/InfoboxPlanet.svelte'
	import InfoboxSystem from '$lib/infoboxes/InfoboxSystem.svelte'
	import SystemMap from '$lib/celestial/SystemMap.svelte'
	import SystemSidebar from '$lib/celestial/SystemSidebar.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'

	let { data }: { data: PageData } = $props()

	const kind = data.kind
	const isAdmin = $derived($page.data.isAdmin)
	const isEditMode = data.isEditMode
	const raw = data.body as any
	const ast = data.ast as import('$lib/parser/types.js').WikiNode | null

	const layoutData = $derived($page.data)

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
	})

	// Edit mode state
	let content = $state(data.wikiContent ?? '')
	let showPreview = $state(true)

	// Build the current path without /edit for cancel link
	const viewPath = $derived($page.url.pathname.replace(/\/edit$/, ''))
	const editPath = $derived(viewPath + '/edit')

	// Breadcrumb: derive parent path segments from URL
	const pathSegments = $derived.by(() => {
		const parts = viewPath.replace('/celestial/', '').split('/').filter(Boolean)
		// Last segment is the current page, everything before is parent
		const parents = parts.slice(0, -1)
		return parents.map((slug, i) => ({
			slug,
			label: slug.replaceAll('-', ' '),
			href: '/celestial/' + parts.slice(0, i + 1).join('/'),
		}))
	})

	// Strip infobox templates from the AST — the celestial page renders its own infobox from structured data
	function stripInfoboxes(node: import('$lib/parser/types.js').WikiNode): import('$lib/parser/types.js').WikiNode | null {
		if (node.type === 'template' && node.name.toLowerCase().startsWith('infobox')) return null
		if ('children' in node && Array.isArray(node.children)) {
			const filtered = node.children.map(stripInfoboxes).filter(Boolean) as import('$lib/parser/types.js').WikiNode[]
			return { ...node, children: filtered }
		}
		return node
	}

	const strippedAst = $derived(ast ? stripInfoboxes(ast) : null)

	// Infobox fields from server — resolved via structured-data.ts (same mapper as from=slug)
	const infoboxFields = $derived(
		data.infoboxFields
			? new Map(Object.entries(data.infoboxFields))
			: new Map([['name', raw.name ?? '']]),
	)
</script>

<svelte:head>
	<title>{isEditMode ? 'Editing ' : ''}{raw.name} — Celestial — KnowThing</title>
</svelte:head>

{#if isEditMode}
	<!-- EDIT MODE -->
	<div>
		<form method="POST" class="flex flex-col h-[calc(100vh-5rem)]">
			<input type="hidden" name="content" value={content} />
			<input type="hidden" name="contentRecordId" value={data.contentRecordId ?? ''} />

			<!-- Top bar -->
			<div class="flex items-center justify-between px-6 py-2 bg-surface border-b border-border">
				<h1 class="text-sm font-bold text-secondary truncate">
					Editing: <span class="text-heading">{raw.name}</span>
				</h1>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (showPreview = !showPreview)}
						class="px-3 py-1 border border-border text-xs text-secondary hover:bg-raised {showPreview ? 'bg-accent-subtle border-accent-border text-accent' : ''}"
					>
						{showPreview ? 'Hide preview' : 'Show preview'}
					</button>
				</div>
			</div>

			<!-- Editor + Preview -->
			<div class="flex-1 flex flex-col min-h-0 md:flex-row">
				<div class="flex-1 min-h-0 min-w-0 overflow-hidden {showPreview ? 'h-1/2 md:h-auto' : ''}">
					<Editor value={data.wikiContent ?? ''} onchange={v => (content = v)} />
				</div>

				{#if showPreview}
					<div class="w-full h-1/2 border-l border-border bg-surface flex flex-col min-h-0 shrink-0 md:w-[45%] md:max-w-2xl md:h-auto">
						<div class="bg-raised px-6 py-1.5 text-xs font-medium text-faint border-b border-border-subtle uppercase tracking-wide">Preview</div>
						<div class="flex-1 overflow-y-auto px-6 py-4">
							<LivePreview {content} />
						</div>
					</div>
				{/if}
			</div>

			<!-- Bottom bar -->
			<div class="flex flex-col items-stretch gap-2 px-6 py-2.5 bg-surface border-t border-border sm:flex-row sm:items-center sm:gap-3">
				<input
					name="summary"
					type="text"
					placeholder="Edit summary (optional)"
					class="flex-1 border border-border px-3 py-2 text-sm bg-page text-body focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border"
				/>
				<div class="flex gap-2">
					<button type="submit" class="flex-1 bg-accent text-accent-text px-5 py-2 font-medium transition-colors text-sm sm:flex-none hover:bg-accent-hover">Save</button>
					<a href={viewPath} class="flex-1 text-center px-5 py-2 border border-border text-secondary text-sm sm:flex-none hover:bg-raised">Cancel</a>
				</div>
			</div>
		</form>
	</div>
{:else}
	<!-- VIEW MODE -->
	<ArticleShell
		breadcrumbs={[
			{ label: 'Celestial', href: '/celestial' },
			...pathSegments.map(s => ({ label: s.label, href: s.href })),
			{ label: raw.name },
		]}
		title={raw.name}
	>
		{#snippet actions()}
			{#if isAdmin}
				<a href={editPath} class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover">
					<PencilSimple size={14} weight="fill" />Edit
				</a>
			{/if}
		{/snippet}
			{#if kind === 'system'}
				<!-- System: two-column layout -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
					<!-- Map -->
					<div>
						{#if data.systemStars && data.systemStars.length > 0}
							<SystemMap
								systemName={raw.name}
								stars={data.systemStars}
								bodies={data.systemBodies ?? []}
							/>
						{:else}
							<div class="flex items-center justify-center h-64 text-dim border border-border-subtle">
								No stars registered in this system.
							</div>
						{/if}
					</div>

					<!-- Sidebar -->
					<div class="border-l border-border-subtle pl-4 hidden md:block">
						<SystemSidebar
							system={raw}
							stars={data.systemStars ?? []}
							bodies={data.systemBodies ?? []}
							systemSlug={raw.slug}
						/>
					</div>

					<!-- Mobile sidebar (no border, below map) -->
					<div class="md:hidden">
						<SystemSidebar
							system={raw}
							stars={data.systemStars ?? []}
							bodies={data.systemBodies ?? []}
							systemSlug={raw.slug}
						/>
					</div>
				</div>

				<!-- Prose below the two-column section -->
				{#if strippedAst}
					<article class="know-article mt-4">
						<WikiNodeComponent node={strippedAst} />
					</article>
				{/if}
			{:else}
				<!-- Star/Planet: standard infobox + prose layout -->
				<article class="know-article">
					{#if kind === 'star'}
						<InfoboxStar fields={infoboxFields} />
					{:else}
						<InfoboxPlanet fields={infoboxFields} />
					{/if}

					{#if strippedAst}
						<WikiNodeComponent node={strippedAst} />
					{:else if !data.wikiContent}
						<p class="text-dim italic mt-4">No article content yet.</p>
					{/if}
				</article>
			{/if}
	</ArticleShell>
{/if}
