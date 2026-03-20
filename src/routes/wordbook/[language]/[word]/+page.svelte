<script lang="ts">
	import type { PageData } from './$types.js';
	import WordGroup from '$lib/components/wordbook/WordGroup.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.word} ({data.language.name}) — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<!-- Breadcrumb -->
	<nav class="text-sm text-stone-500">
		<a href="/wordbook" class="hover:text-amber-700">Wordbook</a>
		<span class="mx-1">›</span>
		<a href="/wordbook/{data.language.slug}" class="hover:text-amber-700">{data.language.name}</a>
		<span class="mx-1">›</span>
		<span class="text-stone-700">{data.word}</span>
	</nav>

	<WordGroup
		word={data.word}
		entries={data.entries}
		languageName={data.language.name}
		languageSlug={data.language.slug}
		languageColor={data.language.color || '#d97706'}
	/>
</div>
