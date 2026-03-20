<script lang="ts">
	import { page } from '$app/stores'

	const layoutData = $derived($page.data)
	const hasMainPage = $derived((layoutData.existingPages || []).includes('main_page'))
</script>

<svelte:head>
	<title>KnowThing</title>
</svelte:head>

{#if hasMainPage}
	<meta http-equiv="refresh" content="0; url=/know/main_page" />
	<p class="text-dim">Redirecting to <a href="/know/main_page" class="text-link hover:underline">Main Page</a>...</p>
{:else}
	<div class="
		bg-surface rounded-lg shadow-sm border border-border p-10 text-center max-w-lg mx-auto mt-12
	">
		<div class="text-4xl mb-4">
			Know<span class="text-accent">Thing</span>
		</div>
		<p class="text-dim mb-8">
			No articles yet. Create your first page to get started.
		</p>
		<a
			href="/know/create?title=Main+Page&slug=main_page"
			class="
				inline-block bg-accent text-surface px-6 py-3 rounded-lg font-medium transition-colors
				shadow-sm
				hover:bg-accent-hover
			"
		>
			Create Main Page
		</a>
	</div>
{/if}
