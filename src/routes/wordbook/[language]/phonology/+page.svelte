<script lang="ts">
	import PhonemeEditor from '$lib/components/phonology/PhonemeEditor.svelte'

	let { data } = $props()
</script>

<svelte:head>
	<title>Phonology — {data.language.name} | KnowThing</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-6">
	<header class="mb-6">
		<div class="text-dim text-sm">
			<a href="/wordbook" class="hover:text-accent">Wordbook</a>
			<span class="mx-1">›</span>
			<a href="/wordbook/{data.language.slug}" class="hover:text-accent">{data.language.name}</a>
		</div>
		<h1 class="text-2xl text-heading font-semibold mt-1">Phonology</h1>
		<p class="text-dim text-sm mt-1">
			Define the sound inventory for {data.language.name}. Reference the grid from any
			wiki page with <code class="text-accent">&#123;&#123;consonants|{data.language.slug}&#125;&#125;</code>,
			<code class="text-accent">&#123;&#123;vowels|{data.language.slug}&#125;&#125;</code>, or
			<code class="text-accent">&#123;&#123;phonology|{data.language.slug}&#125;&#125;</code>.
		</p>
	</header>

	<PhonemeEditor languageSlug={data.language.slug} initial={data.inventory} />
</div>
