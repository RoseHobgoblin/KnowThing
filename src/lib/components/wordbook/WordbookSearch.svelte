<script lang="ts">
	import { goto } from '$app/navigation';

	let { languages = [], large = false }: {
		languages?: Array<{ name: string; slug: string }>;
		large?: boolean;
	} = $props();

	let query = $state('');
	let selectedLanguage = $state('');

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!query.trim()) return;
		const params = new URLSearchParams();
		params.set('q', query.trim());
		if (selectedLanguage) params.set('language', selectedLanguage);
		goto(`/wordbook/search?${params.toString()}`);
	}
</script>

<form onsubmit={handleSubmit} class="flex gap-2 {large ? 'flex-col sm:flex-row' : ''}">
	<div class="flex-1 flex gap-2">
		<input
			type="text"
			bind:value={query}
			placeholder="Search words, definitions, etymology..."
			class="flex-1 px-4 {large ? 'py-3 text-lg' : 'py-2 text-sm'} border border-stone-300 rounded-lg
				focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
				bg-white text-stone-900 placeholder:text-stone-400"
		/>
		{#if languages.length > 0}
			<select
				bind:value={selectedLanguage}
				class="px-3 {large ? 'py-3' : 'py-2'} border border-stone-300 rounded-lg text-sm
					bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
			>
				<option value="">All languages</option>
				{#each languages as lang}
					<option value={lang.slug}>{lang.name}</option>
				{/each}
			</select>
		{/if}
	</div>
	<button
		type="submit"
		class="px-6 {large ? 'py-3' : 'py-2'} bg-amber-600 text-white rounded-lg font-medium
			hover:bg-amber-700 transition-colors text-sm"
	>
		Search
	</button>
</form>
