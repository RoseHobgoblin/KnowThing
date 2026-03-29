<script lang="ts">
	import { goto } from '$app/navigation'

	let { languages = [], large = false }: {
		languages?: Array<{ name: string, slug: string }>
		large?: boolean
	} = $props()

	let query = $state('')
	let selectedLanguage = $state('')
	let searching = $state(false)

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		if (!query.trim()) return
		searching = true
		const params = new URLSearchParams()
		params.set('q', query.trim())
		if (selectedLanguage) params.set('language', selectedLanguage)
		try {
			await goto(`/wordbook/search?${params.toString()}`)
		} finally {
			searching = false
		}
	}
</script>

<form onsubmit={handleSubmit} class="flex gap-2 {large ? 'flex-col sm:flex-row' : ''}">
	<div class="flex-1 flex gap-2">
		<input
			type="text"
			bind:value={query}
			placeholder="Search words, definitions, etymology..."
			class="flex-1 px-4 {large ? 'py-3 text-lg' : 'py-2 text-sm'}
				border border-border-strong bg-surface text-heading
				focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border
				placeholder:text-faint
			"
		/>
		{#if languages.length > 0}
			<select
				bind:value={selectedLanguage}
				class="px-3 {large ? 'py-3' : 'py-2'}
					border border-border-strong text-sm bg-surface text-secondary
					focus:outline-none focus:ring-2 focus:ring-accent
				"
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
		disabled={searching}
		class="px-6 {large ? 'py-3' : 'py-2'} bg-accent text-surface font-medium
			transition-colors text-sm hover:bg-accent-hover disabled:opacity-50"
	>
		{searching ? 'Searching...' : 'Search'}
	</button>
</form>
