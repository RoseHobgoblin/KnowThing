<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'

	let {
		action = '/search',
		query = '',
		scope = 'all',
		language = '',
		tag = '',
		pos = '',
		mediaCategory = '',
		unused = false,
		languages = [],
		partsOfSpeech = [],
		mediaCategories = [],
		clearHref,
	}: {
		action?: string
		query?: string
		scope?: string
		language?: string
		tag?: string
		pos?: string
		mediaCategory?: string
		unused?: boolean
		languages?: Array<{ name: string; slug: string }>
		partsOfSpeech?: Array<{ value: string; label: string }>
		mediaCategories?: string[]
		clearHref: string
	} = $props()

	let selectedLanguage = $state(language)
	let selectedPos = $state(pos)
	let currentTag = $state(tag)
	let currentMediaCategory = $state(mediaCategory)
	let showUnused = $state(unused)

	const showsWordbookFilters = $derived(scope === 'all' || scope === 'wordbook')
	const showsMediaFilters = $derived(scope === 'all' || scope === 'media')
</script>

<form action={action} method="GET" class="bg-surface p-4 space-y-4">
	<input type="hidden" name="q" value={query} />
	<input type="hidden" name="scope" value={scope} />

	<div class="flex items-center justify-between gap-3">
		<h2 class="text-sm font-semibold text-heading">Filters</h2>
		<a href={clearHref} class="text-xs text-secondary hover:text-body">Clear all</a>
	</div>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
		{#if showsWordbookFilters}
			<Select
				type="single"
				label="Language"
				bind:value={selectedLanguage}
				placeholder="All languages"
				items={[{ value: '', label: 'All languages' }, ...languages.map((lang) => ({ value: lang.slug, label: lang.name }))]}
			/>
			<Select
				type="single"
				label="Part of speech"
				bind:value={selectedPos}
				placeholder="Any part of speech"
				items={[{ value: '', label: 'Any part of speech' }, ...partsOfSpeech]}
			/>
			<div>
				<label for="search-tag" class="block text-xs font-medium text-secondary mb-1">Tag</label>
				<input
					id="search-tag"
					name="tag"
					bind:value={currentTag}
					placeholder="e.g. archaic"
					class="w-full px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
				/>
			</div>
		{/if}

		{#if showsMediaFilters}
			<Select
				type="single"
				label="Media category"
				bind:value={currentMediaCategory}
				placeholder="Any category"
				items={[{ value: '', label: 'Any category' }, ...mediaCategories.map((category) => ({ value: category, label: category }))]}
			/>
			<div class="flex items-end">
				<Checkbox bind:value={showUnused} label="Unused only">
					Show media not referenced by content
				</Checkbox>
			</div>
		{/if}
	</div>

	<input type="hidden" name="language" value={selectedLanguage} />
	<input type="hidden" name="pos" value={selectedPos} />
	<input type="hidden" name="mediaCategory" value={currentMediaCategory} />
	{#if showUnused}
		<input type="hidden" name="unused" value="true" />
	{/if}

	<div class="flex justify-end">
		<button type="submit" class="px-4 py-2 bg-raised text-body text-sm hover:bg-page">
			Apply filters
		</button>
	</div>
</form>
