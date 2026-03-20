<script lang="ts">
	let { entryId, onrelationadded }: {
		entryId: number;
		onrelationadded: () => void;
	} = $props();

	let relationType = $state('derived_from');
	let targetQuery = $state('');
	let targetId = $state<number | null>(null);
	let targetDisplay = $state('');
	let notes = $state('');
	let submitting = $state(false);
	let error = $state('');
	let searchResults = $state<Array<{ id: number; word: string; definition: string; languageName: string; languageSlug: string }>>([]);
	let showDropdown = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleSearch() {
		if (searchTimeout) clearTimeout(searchTimeout);
		targetId = null;
		targetDisplay = '';

		if (targetQuery.trim().length < 2) {
			searchResults = [];
			showDropdown = false;
			return;
		}

		searchTimeout = setTimeout(async () => {
			const res = await fetch(`/api/wordbook?q=${encodeURIComponent(targetQuery.trim())}&limit=10`);
			if (res.ok) {
				searchResults = await res.json();
				showDropdown = searchResults.length > 0;
			}
		}, 300);
	}

	function selectTarget(result: typeof searchResults[0]) {
		targetId = result.id;
		targetDisplay = `${result.word} (${result.languageName})`;
		targetQuery = targetDisplay;
		showDropdown = false;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!targetId || !relationType) {
			error = 'Select a target word';
			return;
		}

		error = '';
		submitting = true;

		try {
			const res = await fetch(`/api/wordbook/${entryId}/relations`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetId,
					relationType,
					notes: notes.trim() || undefined
				})
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || 'Failed to add relation');
			}

			// Reset form
			targetQuery = '';
			targetId = null;
			targetDisplay = '';
			notes = '';
			onrelationadded();
		} catch (e: any) {
			error = e.message;
		} finally {
			submitting = false;
		}
	}

	const typeLabels: Record<string, string> = {
		derived_from: 'Derived from',
		loan_from: 'Borrowed from',
		compound_of: 'Compound of'
	};
</script>

<div class="mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
	<h4 class="text-xs font-medium uppercase tracking-wide text-stone-500 mb-3">Add etymological relation</h4>

	<form onsubmit={handleSubmit} class="space-y-3">
		{#if error}
			<div class="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>
		{/if}

		<div class="flex gap-3 flex-wrap">
			<!-- Relation type -->
			<select
				bind:value={relationType}
				class="px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
			>
				{#each Object.entries(typeLabels) as [value, label]}
					<option {value}>{label}</option>
				{/each}
			</select>

			<!-- Target word search -->
			<div class="relative flex-1 min-w-[200px]">
				<input
					type="text"
					bind:value={targetQuery}
					oninput={handleSearch}
					onfocus={() => { if (searchResults.length > 0) showDropdown = true; }}
					onblur={() => setTimeout(() => showDropdown = false, 200)}
					placeholder="Search for target word..."
					class="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
				/>
				{#if showDropdown}
					<div class="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
						{#each searchResults as result}
							<button
								type="button"
								onclick={() => selectTarget(result)}
								class="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm border-b border-stone-100 last:border-0"
							>
								<span class="font-medium">{result.word}</span>
								<span class="text-stone-400 text-xs ml-1">({result.languageName})</span>
								<span class="text-stone-500 text-xs block">{result.definition}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Notes -->
		<input
			type="text"
			bind:value={notes}
			placeholder="Notes (optional) — e.g., 'via 15th century trade contact'"
			class="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
		/>

		<button
			type="submit"
			disabled={submitting || !targetId}
			class="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
		>
			{submitting ? 'Adding...' : 'Add Relation'}
		</button>
	</form>
</div>
