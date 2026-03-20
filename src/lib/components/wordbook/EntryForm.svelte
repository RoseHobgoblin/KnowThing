<script lang="ts">
	let {
		languages = [],
		initial = {},
		submitLabel = 'Save Entry',
		onsubmit
	}: {
		languages: Array<{ id: number; name: string; slug: string }>;
		initial?: {
			word?: string;
			languageId?: number;
			pronunciation?: string;
			partOfSpeech?: string;
			definition?: string;
			etymology?: string;
			usageExample?: string;
			usageTranslation?: string;
			notes?: string;
			pageSlug?: string;
			tags?: string[];
		};
		submitLabel?: string;
		onsubmit: (data: Record<string, unknown>) => Promise<void>;
	} = $props();

	let word = $state(initial.word || '');
	let languageId = $state(initial.languageId || 0);
	let pronunciation = $state(initial.pronunciation || '');
	let partOfSpeech = $state(initial.partOfSpeech || '');
	let definition = $state(initial.definition || '');
	let etymology = $state(initial.etymology || '');
	let usageExample = $state(initial.usageExample || '');
	let usageTranslation = $state(initial.usageTranslation || '');
	let notes = $state(initial.notes || '');
	let pageSlug = $state(initial.pageSlug || '');
	let tagsInput = $state(initial.tags?.join(', ') || '');
	let submitting = $state(false);
	let error = $state('');

	// Quick etymology relations
	type EtymRow = { relationType: string; targetId: number | null; targetDisplay: string; query: string; results: Array<{ id: number; word: string; definition: string; languageName: string; languageSlug: string }>; showDropdown: boolean };
	let etymRows = $state<EtymRow[]>([]);
	let searchTimeouts = new Map<number, ReturnType<typeof setTimeout>>();

	function addEtymRow() {
		etymRows = [...etymRows, { relationType: 'derived_from', targetId: null, targetDisplay: '', query: '', results: [], showDropdown: false }];
	}

	function removeEtymRow(index: number) {
		etymRows = etymRows.filter((_, i) => i !== index);
	}

	function handleEtymSearch(index: number) {
		const row = etymRows[index];
		row.targetId = null;
		row.targetDisplay = '';
		const existing = searchTimeouts.get(index);
		if (existing) clearTimeout(existing);
		if (row.query.trim().length < 2) { row.results = []; row.showDropdown = false; return; }
		searchTimeouts.set(index, setTimeout(async () => {
			const res = await fetch(`/api/wordbook?q=${encodeURIComponent(row.query.trim())}&limit=8`);
			if (res.ok) { row.results = await res.json(); row.showDropdown = row.results.length > 0; }
		}, 300));
	}

	function selectEtymTarget(index: number, r: EtymRow['results'][0]) {
		const row = etymRows[index];
		row.targetId = r.id;
		row.targetDisplay = `${r.word} (${r.languageName})`;
		row.query = row.targetDisplay;
		row.showDropdown = false;
	}

	const partsOfSpeech = [
		'noun', 'verb', 'adjective', 'adverb', 'pronoun',
		'preposition', 'conjunction', 'interjection', 'particle',
		'determiner', 'prefix', 'suffix', 'proper noun'
	];

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!word.trim() || !definition.trim() || !languageId) {
			error = 'Word, language, and definition are required';
			return;
		}

		error = '';
		submitting = true;
		try {
			await onsubmit({
				word: word.trim(),
				languageId,
				pronunciation: pronunciation.trim() || undefined,
				partOfSpeech: partOfSpeech || undefined,
				definition: definition.trim(),
				etymology: etymology.trim() || undefined,
				usageExample: usageExample.trim() || undefined,
				usageTranslation: usageTranslation.trim() || undefined,
				notes: notes.trim() || undefined,
				pageSlug: pageSlug.trim() || undefined,
				tags: tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [],
				relations: etymRows
					.filter(r => r.targetId)
					.map(r => ({ targetId: r.targetId, relationType: r.relationType }))
			});
		} catch (e: any) {
			error = e.message || 'Failed to save';
		} finally {
			submitting = false;
		}
	}

	const inputClass = 'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400';
	const labelClass = 'block text-sm font-medium text-stone-700 mb-1';
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	{#if error}
		<div class="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- Word -->
		<div>
			<label for="word" class={labelClass}>Word <span class="text-red-500">*</span></label>
			<input id="word" type="text" bind:value={word} required class={inputClass} placeholder="txanpon" />
		</div>

		<!-- Language -->
		<div>
			<label for="language" class={labelClass}>Language <span class="text-red-500">*</span></label>
			<select id="language" bind:value={languageId} required class={inputClass}>
				<option value={0} disabled>Select language...</option>
				{#each languages as lang}
					<option value={lang.id}>{lang.name}</option>
				{/each}
			</select>
		</div>

		<!-- Pronunciation -->
		<div>
			<label for="pronunciation" class={labelClass}>Pronunciation (IPA)</label>
			<input id="pronunciation" type="text" bind:value={pronunciation} class={inputClass} placeholder="/tʃan.pon/" />
		</div>

		<!-- Part of Speech -->
		<div>
			<label for="pos" class={labelClass}>Part of Speech</label>
			<select id="pos" bind:value={partOfSpeech} class={inputClass}>
				<option value="">—</option>
				{#each partsOfSpeech as pos}
					<option value={pos}>{pos}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Definition -->
	<div>
		<label for="definition" class={labelClass}>Definition <span class="text-red-500">*</span></label>
		<textarea id="definition" bind:value={definition} required rows={3} class={inputClass} placeholder="A unit of currency used in..."></textarea>
	</div>

	<!-- Usage -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="usage" class={labelClass}>Usage Example</label>
			<input id="usage" type="text" bind:value={usageExample} class={inputClass} placeholder="Sentence in the language" />
		</div>
		<div>
			<label for="translation" class={labelClass}>Translation</label>
			<input id="translation" type="text" bind:value={usageTranslation} class={inputClass} placeholder="English translation" />
		</div>
	</div>

	<!-- Tags & Wiki link -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="tags" class={labelClass}>Tags <span class="text-xs text-stone-400">(comma-separated)</span></label>
			<input id="tags" type="text" bind:value={tagsInput} class={inputClass} placeholder="economics, currency, daily life" />
		</div>
		<div>
			<label for="pageSlug" class={labelClass}>Wiki Article <span class="text-xs text-stone-400">(slug)</span></label>
			<input id="pageSlug" type="text" bind:value={pageSlug} class={inputClass} placeholder="oncheran_economy" />
		</div>
	</div>

	<!-- Etymology notes & Notes -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="etymology" class={labelClass}>Etymology Notes <span class="text-xs text-stone-400">(narrative)</span></label>
			<input id="etymology" type="text" bind:value={etymology} class={inputClass} placeholder="Origin disputed, possibly pre-Mirish substrate" />
		</div>
		<div>
			<label for="notes" class={labelClass}>Editorial Notes</label>
			<input id="notes" type="text" bind:value={notes} class={inputClass} placeholder="Needs verification..." />
		</div>
	</div>

	<!-- Quick Etymology -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<label class={labelClass}>Etymology Links</label>
			<button type="button" onclick={addEtymRow} class="text-xs text-amber-700 hover:text-amber-900 hover:underline">+ Add source word</button>
		</div>
		{#if etymRows.length === 0}
			<p class="text-xs text-stone-400">No etymological links. Click "+ Add source word" to link derivations, loans, or compounds.</p>
		{/if}
		{#each etymRows as row, i}
			<div class="flex gap-2 items-start mb-2">
				<select bind:value={row.relationType} class="px-2 py-1.5 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
					<option value="derived_from">Derived from</option>
					<option value="loan_from">Borrowed from</option>
					<option value="compound_of">Compound of</option>
				</select>
				<div class="relative flex-1">
					<input
						type="text"
						bind:value={row.query}
						oninput={() => handleEtymSearch(i)}
						onfocus={() => { if (row.results.length > 0) row.showDropdown = true; }}
						onblur={() => setTimeout(() => row.showDropdown = false, 200)}
						placeholder="Search for a word..."
						class="w-full px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 {row.targetId ? 'border-green-300 bg-green-50' : ''}"
					/>
					{#if row.showDropdown}
						<div class="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
							{#each row.results as result}
								<button type="button" onclick={() => selectEtymTarget(i, result)} class="w-full text-left px-3 py-1.5 hover:bg-amber-50 text-sm border-b border-stone-100 last:border-0">
									<span class="font-medium">{result.word}</span>
									<span class="text-stone-400 text-xs ml-1">({result.languageName})</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<button type="button" onclick={() => removeEtymRow(i)} class="text-red-400 hover:text-red-600 text-sm px-1 py-1">×</button>
			</div>
		{/each}
	</div>

	<div class="pt-2">
		<button
			type="submit"
			disabled={submitting}
			class="px-6 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
		>
			{submitting ? 'Saving...' : submitLabel}
		</button>
	</div>
</form>
