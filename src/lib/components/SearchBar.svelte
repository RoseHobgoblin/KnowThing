<script lang="ts">
	import { goto } from '$app/navigation'
	import { Combobox } from 'bits-ui'
	import { createQuery } from '@tanstack/svelte-query'
	import { useDebounce } from 'runed'
	import { api } from '$lib/api'
	import { sanitizeSnippet } from '$lib/utils.js'

	type SearchResult = { href: string, title: string, snippet: string, badge: string }

	let query = $state('')
	let debounced = $state('')
	let open = $state(false)
	let inputRef = $state<HTMLInputElement | null>(null)

	const setDebounced = useDebounce(() => debounced = query.trim(), 250)

	function onInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value
		if (!query.trim()) {
			setDebounced.cancel()
			debounced = ''
			return
		}
		setDebounced()
	}

	const search = createQuery(() => ({
		queryKey: ['search-suggest', debounced],
		queryFn: () => api<{ results?: SearchResult[] }>('GET', `/api/search?q=${encodeURIComponent(debounced)}&limit=8`),
		enabled: debounced.length > 0,
	}))

	const results = $derived(debounced.length > 0 ? search.data?.results ?? [] : [])

	function reset() {
		setDebounced.cancel()
		query = ''
		debounced = ''
		open = false
		inputRef?.blur()
	}

	function navigate(href: string) {
		reset()
		goto(href)
	}

	function fullSearch(scope?: string) {
		if (!query.trim()) return
		const searchQuery = query
		reset()
		goto(`/search?q=${encodeURIComponent(searchQuery)}${scope ? `&scope=${scope}` : ''}`)
	}

	// Enter with no highlighted suggestion falls through to the full search page;
	// with a highlighted one, bits-ui selects it and onValueChange navigates.
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return
		if (!document.querySelector('#searchbar-results [data-highlighted]')) {
			event.preventDefault()
			fullSearch()
		}
	}
</script>

<Combobox.Root
	type="single"
	inputValue={query}
	bind:open
	bind:value={() => '', (href) => { if (href) navigate(href) }}
>
	<Combobox.Input
		bind:ref={inputRef}
		dir="ltr"
		autocomplete="off"
		oninput={onInput}
		onkeydown={onKeydown}
		placeholder="Search pages, wordbook, media..."
		aria-label="Search"
		class="
			w-full px-3 py-1.5 text-sm bg-page transition-colors
			focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent
		"
	/>

	<Combobox.Portal>
		<Combobox.Content
			id="searchbar-results"
			sideOffset={2}
			class={results.length > 0
				? 'z-[9999] max-h-80 w-(--bits-combobox-anchor-width) min-w-(--bits-combobox-anchor-width) overflow-y-auto bg-surface shadow-lg outline-none'
				: 'hidden'}
		>
			{#each results as r (r.href)}
				<Combobox.Item
					value={r.href}
					label={r.title}
					class="block px-3 py-2.5 border-b border-border-subtle transition-colors cursor-pointer outline-none data-highlighted:bg-accent-subtle"
				>
					<div class="flex items-center gap-2">
						<div class="font-medium text-sm text-heading">{r.title}</div>
						<span class="text-xs uppercase tracking-wide text-secondary">{r.badge}</span>
					</div>
					{#if r.snippet}
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitizeSnippet escapes all but <mark> -->
						<div class="text-xs text-dim mt-0.5">{@html sanitizeSnippet(r.snippet)}</div>
					{/if}
				</Combobox.Item>
			{/each}
			<button
				type="button"
				onclick={() => fullSearch('all')}
				class="w-full px-3 py-2 text-left text-xs text-link border-t border-border-subtle hover:bg-accent-subtle"
			>
				View all results
			</button>
		</Combobox.Content>
	</Combobox.Portal>
</Combobox.Root>
