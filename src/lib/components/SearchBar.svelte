<script lang="ts">
	let query = $state('');
	let results = $state<{ slug: string; title: string; snippet: string }[]>([]);
	let showResults = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	function onInput() {
		clearTimeout(debounceTimer);
		if (!query.trim()) {
			results = [];
			showResults = false;
			return;
		}
		debounceTimer = setTimeout(doSearch, 250);
	}

	async function doSearch() {
		if (!query.trim()) return;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
			if (res.ok) {
				results = await res.json();
				showResults = true;
			}
		} catch {
			// ignore
		}
	}

	function onSubmit(e: Event) {
		e.preventDefault();
		if (query.trim()) {
			window.location.href = `/search?q=${encodeURIComponent(query)}`;
		}
	}

	function close() {
		setTimeout(() => (showResults = false), 200);
	}
</script>

<form onsubmit={onSubmit} class="relative">
	<input
		type="search"
		bind:value={query}
		oninput={onInput}
		onfocusin={() => results.length > 0 && (showResults = true)}
		onfocusout={close}
		placeholder="Search..."
		class="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-colors"
	/>

	{#if showResults && results.length > 0}
		<div class="absolute top-full left-0 right-0 bg-white border border-stone-200 rounded-b-lg shadow-lg z-50 max-h-80 overflow-y-auto mt-0.5">
			{#each results as r}
				<a
					href="/know/{r.slug}"
					class="block px-3 py-2.5 hover:bg-amber-50 border-b border-stone-100 transition-colors"
				>
					<div class="font-medium text-sm text-stone-900">{r.title}</div>
					{#if r.snippet}
						<div class="text-xs text-stone-500 mt-0.5">{@html r.snippet}</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</form>
