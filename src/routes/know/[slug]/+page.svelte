<script lang="ts">
	import type { PageData } from './$types.js';
	import WikiNodeComponent from '$lib/renderer/WikiNode.svelte';
	import { createKnowContext } from '$lib/renderer/context.js';
	import TableOfContents from '$lib/components/TableOfContents.svelte';
	import CategoryBar from '$lib/components/CategoryBar.svelte';
	import { page } from '$app/stores';

	let { data }: { data: PageData } = $props();

	const layoutData = $derived($page.data);

	createKnowContext({
		existingPages: new Set(layoutData.existingPages || []),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know'
	});
</script>

<svelte:head>
	<title>{data.title} — KnowThing</title>
</svelte:head>

{#key data.slug}
{#if data.notFound}
	<div class="bg-white rounded-lg shadow-sm border border-stone-200 p-8 text-center">
		<h1 class="text-2xl font-bold mb-3 text-stone-800">{data.title}</h1>
		<p class="text-stone-500 mb-6">
			This article doesn't exist yet.
		</p>
		<a
			href="/know/create?title={encodeURIComponent(data.title)}&slug={data.slug}"
			class="inline-block px-5 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
		>
			Create this page
		</a>
	</div>
{:else if data.ast}
	<!-- Article card -->
	<div class="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
		<!-- Page header -->
		<div class="flex items-center justify-between px-6 py-4 border-b border-stone-100">
			<h1 class="text-2xl font-bold text-stone-900">{data.title}</h1>
			<div class="flex gap-4 text-sm">
				<a href="/know/{data.slug}/edit" class="text-amber-700 hover:text-amber-900 font-medium transition-colors">Edit</a>
				<a href="/know/{data.slug}/history" class="text-stone-500 hover:text-stone-700 transition-colors">History</a>
			</div>
		</div>

		<!-- Article body -->
		<div class="px-6 py-5">
			<TableOfContents ast={data.ast} />

			<article class="know-article">
				<WikiNodeComponent node={data.ast} />
			</article>

			<CategoryBar categories={data.categories} />

			{#if data.updatedAt}
				<div class="mt-6 pt-4 border-t border-stone-100 text-xs text-stone-400">
					Last edited {new Date(data.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
				</div>
			{/if}
		</div>
	</div>
{/if}
{/key}
