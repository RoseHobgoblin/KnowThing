<script lang="ts">
	import { page } from '$app/stores';

	const layoutData = $derived($page.data);
	const hasMainPage = $derived((layoutData.existingPages || []).includes('main_page'));
</script>

<svelte:head>
	<title>KnowThing</title>
</svelte:head>

{#if hasMainPage}
	<meta http-equiv="refresh" content="0; url=/know/main_page" />
	<p class="text-stone-500">Redirecting to <a href="/know/main_page" class="text-amber-700 hover:underline">Main Page</a>...</p>
{:else}
	<div class="bg-white rounded-lg shadow-sm border border-stone-200 p-10 text-center max-w-lg mx-auto mt-12">
		<div class="text-4xl mb-4">
			Know<span class="text-amber-600">Thing</span>
		</div>
		<p class="text-stone-500 mb-8">
			No articles yet. Create your first page to get started.
		</p>
		<a
			href="/know/create?title=Main+Page&slug=main_page"
			class="inline-block bg-amber-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors shadow-sm"
		>
			Create Main Page
		</a>
	</div>
{/if}
