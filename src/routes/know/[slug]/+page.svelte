<script lang="ts">
	import type { PageData } from './$types.js'
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'
import CategoryBar from '$lib/components/CategoryBar.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'

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

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
		calendarDate: layoutData.calendarDate ?? null,
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
	<!-- Article card -->
	<div class="bg-surface shadow-sm border border-border overflow-hidden">
		<!-- Page header -->
		<div class="
			flex flex-col justify-between gap-2 p-4 border-b border-border-subtle
			sm:flex-row sm:items-center
			md:px-6
		">
			<h1 class="text-2xl font-bold text-heading md:text-3xl">{data.title}</h1>
			<div class="flex gap-3 text-sm md:gap-4">
				<a href="/know/{data.slug}/edit" class="text-link font-medium transition-colors hover:text-link-hover">Edit</a>
				<a href="/know/{data.slug}/move" class="text-dim transition-colors hover:text-secondary">Move</a>
				<a href="/know/{data.slug}/history" class="text-dim transition-colors hover:text-secondary">History</a>
				{#if layoutData.user?.role === 'admin'}
					<button onclick={deletePage} class="text-error transition-colors hover:text-error-hover">Delete</button>
				{/if}
			</div>
		</div>

		<!-- Wordbook link -->
		{#if data.wordbookMatch}
			<div class="px-4 pt-3 pb-0 md:px-6">
				<a
					href="/wordbook/{data.wordbookMatch.languageSlug}/{encodeURIComponent(data.wordbookMatch.word)}"
					class="
						inline-flex items-center gap-1.5 text-xs text-link bg-accent-subtle border border-accent-border
						px-3 py-1 transition-colors
						hover:text-link-hover
					"
				>
					<span class="font-medium">Wordbook</span>
					<span class="text-accent">·</span>
					<span>See <em>{data.wordbookMatch.word}</em> in {data.wordbookMatch.languageName}</span>
				</a>
			</div>
		{/if}

		<!-- Article body -->
		<div class="p-4 md:px-6 md:py-5">
			<article class="know-article">
				<WikiNodeComponent node={data.ast} />
			</article>

			<CategoryBar categories={data.categories} />

			{#if data.updatedAt}
				<div class="mt-6 pt-4 border-t border-border-subtle text-xs text-faint">
					Last edited {new Date(data.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
				</div>
			{/if}
		</div>
	</div>
{/if}
{/key}

<ConfirmDialog bind:this={confirmDialog} />
