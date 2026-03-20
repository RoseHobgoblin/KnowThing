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
			related?: string[];
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
	let relatedInput = $state(initial.related?.join(', ') || '');
	let submitting = $state(false);
	let error = $state('');

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
				related: relatedInput ? relatedInput.split(',').map(r => r.trim()).filter(Boolean) : []
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

	<!-- Etymology -->
	<div>
		<label for="etymology" class={labelClass}>Etymology</label>
		<textarea id="etymology" bind:value={etymology} rows={2} class={inputClass} placeholder="From Tambuli 'txan' (metal) + 'pon' (round)"></textarea>
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

	<!-- Tags & Related -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="tags" class={labelClass}>Tags <span class="text-xs text-stone-400">(comma-separated)</span></label>
			<input id="tags" type="text" bind:value={tagsInput} class={inputClass} placeholder="economics, currency, daily life" />
		</div>
		<div>
			<label for="related" class={labelClass}>Related Words <span class="text-xs text-stone-400">(comma-separated)</span></label>
			<input id="related" type="text" bind:value={relatedInput} class={inputClass} placeholder="txanponeri, pon" />
		</div>
	</div>

	<!-- Wiki link & Notes -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="pageSlug" class={labelClass}>Wiki Article <span class="text-xs text-stone-400">(slug)</span></label>
			<input id="pageSlug" type="text" bind:value={pageSlug} class={inputClass} placeholder="oncheran_economy" />
		</div>
		<div>
			<label for="notes" class={labelClass}>Notes</label>
			<input id="notes" type="text" bind:value={notes} class={inputClass} placeholder="Editorial notes..." />
		</div>
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
