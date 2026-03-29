<script lang="ts">
	import type { PageData } from './$types.js'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
import CategoryBar from '$lib/components/CategoryBar.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
	import ArrowsLeftRight from 'phosphor-svelte/lib/ArrowsLeftRight'
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
	import Trash from 'phosphor-svelte/lib/Trash'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	async function deletePage() {
		const ok = await confirmDialog.confirm('Delete page', `Delete "${data.title}"? This cannot be undone.`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/pages/${data.slug}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${data.title}" deleted`)
			goto('/')
		} else {
			pushError('Failed to delete page')
		}
	}

	const layoutData = $derived($page.data)

	// Reconstruct structured data Maps from serialized JSON
	const structuredData = $derived.by(() => {
		const raw = data.structuredData
		if (!raw) return null
		const map = new Map<string, Map<string, string>>()
		for (const [slug, fields] of Object.entries(raw)) {
			map.set(slug, new Map(Object.entries(fields)))
		}
		return map
	})

	// Build existingContent map from layout data
	const existingContent = $derived.by(() => {
		const map = new Map<string, Set<string>>()
		const items = layoutData.existingContent || []
		for (const { domain, slug } of items) {
			if (!map.has(domain)) map.set(domain, new Set())
			map.get(domain)!.add(slug)
		}
		return map
	})

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		existingContent,
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
		structuredData: structuredData,
		systemMaps: data.systemMaps ?? null,
	})
</script>

<svelte:head>
	<title>{data.title} — KnowThing</title>
</svelte:head>

{#key data.slug}

{#if data.notFound}
	<div class="bg-surface shadow-sm border border-border p-8 text-center">
		<h1 class="text-2xl font-bold mb-3 text-body">{data.title}</h1>
		<p class="text-dim mb-6">
			This article doesn't exist yet.
		</p>
		<a
			href="/know/create?title={encodeURIComponent(data.title)}&slug={data.slug}"
			class="
				inline-block px-5 py-2.5 bg-accent text-surface font-medium transition-colors
				hover:bg-accent-hover
			"
		>
			Create this page
		</a>
	</div>
{:else if data.ast}
	<ArticleShell
		breadcrumbs={[{ label: 'Main Page', href: '/' }, { label: data.title }]}
		title={data.title}
	>
		{#snippet actions()}
			<a href="/know/{data.slug}/edit" class="text-link font-medium transition-colors flex items-center gap-1 hover:text-link-hover"><PencilSimple size={14} weight="fill" />Edit</a>
			<a href="/know/{data.slug}/move" class="text-dim transition-colors flex items-center gap-1 hover:text-secondary"><ArrowsLeftRight size={14} weight="fill" />Move</a>
			<a href="/know/{data.slug}/history" class="text-dim transition-colors flex items-center gap-1 hover:text-secondary"><ClockCounterClockwise size={14} weight="fill" />History</a>
			{#if layoutData.user?.role === 'admin'}
				<button onclick={deletePage} class="text-error transition-colors flex items-center gap-1 hover:text-error-hover"><Trash size={14} weight="fill" />Delete</button>
			{/if}
		{/snippet}

		{#snippet badges()}
			{#if data.wordbookMatch}
				<div class="flex items-center gap-2 mt-1.5 text-xs">
					<span class="px-1.5 py-0.5 bg-accent-light text-accent-text font-semibold uppercase tracking-wider text-[10px]">Wordbook</span>
					<a
						href="/wordbook/{data.wordbookMatch.languageSlug}/{encodeURIComponent(data.wordbookMatch.word)}"
						class="text-link transition-colors hover:text-link-hover"
					>
						See <em>{data.wordbookMatch.word}</em> in {data.wordbookMatch.languageName}
					</a>
				</div>
			{/if}
		{/snippet}

		<article class="know-article">
			<WikiNodeComponent node={data.ast} />
		</article>

		<CategoryBar categories={data.categories} />

		{#if data.updatedAt}
			<div class="clear-both mt-6 pt-4 border-t border-border-subtle text-xs text-faint">
				Last edited {new Date(data.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
			</div>
		{/if}
	</ArticleShell>
{/if}
{/key}

<ConfirmDialog bind:this={confirmDialog} />
