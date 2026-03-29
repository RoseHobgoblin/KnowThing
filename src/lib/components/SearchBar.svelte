<script lang="ts">
	import { goto } from '$app/navigation'

	let query = $state('')
	let results = $state<{ slug: string, title: string, snippet: string }[]>([])
	let showResults = $state(false)
	let selectedIndex = $state(-1)
	let debounceTimer: ReturnType<typeof setTimeout>
	let inputEl: HTMLInputElement | undefined = $state()

	function onInput() {
		clearTimeout(debounceTimer)
		selectedIndex = -1
		if (!query.trim()) {
			results = []
			showResults = false
			return
		}
		debounceTimer = setTimeout(doSearch, 250)
	}

	async function doSearch() {
		if (!query.trim()) return
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`)
			if (res.ok) {
				results = await res.json()
				showResults = true
				selectedIndex = -1
			}
		} catch {
			// ignore
		}
	}

	function navigate(slug: string) {
		query = ''
		results = []
		showResults = false
		selectedIndex = -1
		inputEl?.blur()
		goto(`/know/${slug}`)
	}

	function onKeydown(event: KeyboardEvent) {
		if (!showResults || results.length === 0) {
			if (event.key === 'Enter') {
				event.preventDefault()
				if (query.trim()) {
					const searchQuery = query
					query = ''
					results = []
					showResults = false
					inputEl?.blur()
					goto(`/search?q=${encodeURIComponent(searchQuery)}`)
				}
			}
			return
		}

		switch (event.key) {
			case 'ArrowDown': {
				event.preventDefault()
				selectedIndex = selectedIndex < results.length - 1 ? selectedIndex + 1 : 0
				break
			}
			case 'ArrowUp': {
				event.preventDefault()
				selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : results.length - 1
				break
			}
			case 'Enter': {
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < results.length) {
					navigate(results[selectedIndex].slug)
				} else if (query.trim()) {
					const searchQuery = query
					query = ''
					results = []
					showResults = false
					inputEl?.blur()
					goto(`/search?q=${encodeURIComponent(searchQuery)}`)
				}
				break
			}
			case 'Escape': {
				showResults = false
				selectedIndex = -1
				inputEl?.blur()
				break
			}
		}
	}

	function onSubmit(event: Event) {
		event.preventDefault()
		// Handled by onKeydown Enter
	}

	function close() {
		setTimeout(() => {
			showResults = false
			selectedIndex = -1
		}, 200)
	}
</script>

<form onsubmit={onSubmit} class="relative">
	<input
		bind:this={inputEl}
		type="text"
		dir="ltr"
		autocomplete="off"
		bind:value={query}
		oninput={onInput}
		onkeydown={onKeydown}
		onfocusin={() => results.length > 0 && (showResults = true)}
		onfocusout={close}
		placeholder="Search..."
		role="combobox"
		aria-expanded={showResults && results.length > 0}
		aria-autocomplete="list"
		aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
		class="
			w-full border border-border px-3 py-1.5 text-sm bg-page transition-colors
			focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border
		"
	/>

	{#if showResults && results.length > 0}
		<div
			class="
				absolute top-full inset-x-0 bg-surface border border-border shadow-lg z-50 max-h-80
				overflow-y-auto mt-0.5
			"
			role="listbox"
		>
			{#each results as r, i}
				<a
					id="search-result-{i}"
					href="/know/{r.slug}"
					onclick={(e) => { e.preventDefault(); navigate(r.slug) }}
					class="block px-3 py-2.5 border-b border-border-subtle transition-colors
						{i === selectedIndex ? 'bg-accent-subtle' : 'hover:bg-accent-subtle'}"
					role="option"
					aria-selected={i === selectedIndex}
				>
					<div class="font-medium text-sm text-heading">{r.title}</div>
					{#if r.snippet}
						<div class="text-xs text-dim mt-0.5">{@html r.snippet}</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</form>
