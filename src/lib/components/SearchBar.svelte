<script lang="ts">
	let query = $state('')
	let results = $state<{ slug: string, title: string, snippet: string }[]>([])
	let showResults = $state(false)
	let debounceTimer: ReturnType<typeof setTimeout>

	function onInput() {
		clearTimeout(debounceTimer)
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
			}
		} catch {
			// ignore
		}
	}

	function onSubmit(event: Event) {
		event.preventDefault()
		if (query.trim()) {
			globalThis.location.href = `/search?q=${encodeURIComponent(query)}`
		}
	}

	function close() {
		setTimeout(() => (showResults = false), 200)
	}
</script>

<form onsubmit={onSubmit} class="relative">
	<input
		type="text"
		dir="ltr"
		autocomplete="off"
		bind:value={query}
		oninput={onInput}
		onfocusin={() => results.length > 0 && (showResults = true)}
		onfocusout={close}
		placeholder="Search..."
		class="
			w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-page transition-colors
			focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border
		"
	/>

	{#if showResults && results.length > 0}
		<div class="
			absolute top-full inset-x-0 bg-surface border border-border rounded-b-lg shadow-lg z-50 max-h-80
			overflow-y-auto mt-0.5
		">
			{#each results as r}
				<a
					href="/know/{r.slug}"
					class="block px-3 py-2.5 border-b border-border-subtle transition-colors hover:bg-accent-subtle"
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
