<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { PARTS_OF_SPEECH } from './constants.js';

	let { languageSlug, dimensions = [], classes = [] }: {
		languageSlug: string;
		dimensions: Array<{ id: number; languageId: number; partOfSpeech: string; name: string; dimValues: string[]; sortOrder: number }>;
		classes: Array<{ id: number; languageId: number; partOfSpeech: string; name: string; description: string | null }>;
	} = $props();

	// Group dimensions by POS
	const grouped = $derived(() => {
		const map = new Map<string, typeof dimensions>();
		for (const d of dimensions) {
			if (!map.has(d.partOfSpeech)) map.set(d.partOfSpeech, []);
			map.get(d.partOfSpeech)!.push(d);
		}
		return map;
	});

	const classesGrouped = $derived(() => {
		const map = new Map<string, typeof classes>();
		for (const c of classes) {
			if (!map.has(c.partOfSpeech)) map.set(c.partOfSpeech, []);
			map.get(c.partOfSpeech)!.push(c);
		}
		return map;
	});

	// Add dimension form
	let showAddDim = $state(false);
	let newDimPos = $state('noun');
	let newDimName = $state('');
	let newDimValues = $state('');
	let newDimSort = $state(0);
	let addingDim = $state(false);

	async function addDimension(e: SubmitEvent) {
		e.preventDefault();
		if (!newDimName.trim() || !newDimValues.trim()) return;
		addingDim = true;
		const res = await fetch(`/api/languages/${languageSlug}/inflections/dimensions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: newDimPos,
				name: newDimName.trim(),
				values: newDimValues.split(',').map(v => v.trim()).filter(Boolean),
				sortOrder: newDimSort
			})
		});
		if (res.ok) {
			newDimName = ''; newDimValues = ''; showAddDim = false;
			invalidateAll();
		}
		addingDim = false;
	}

	async function deleteDimension(dimId: number) {
		if (!confirm('Remove this dimension? This will affect all paradigm rules using it.')) return;
		await fetch(`/api/languages/${languageSlug}/inflections/dimensions/${dimId}`, { method: 'DELETE' });
		invalidateAll();
	}

	// Add class form
	let showAddClass = $state(false);
	let newClassPos = $state('noun');
	let newClassName = $state('');
	let newClassDesc = $state('');
	let addingClass = $state(false);

	async function addClass(e: SubmitEvent) {
		e.preventDefault();
		if (!newClassName.trim()) return;
		addingClass = true;
		const res = await fetch(`/api/languages/${languageSlug}/inflections/classes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: newClassPos,
				name: newClassName.trim(),
				description: newClassDesc.trim() || undefined
			})
		});
		if (res.ok) {
			newClassName = ''; newClassDesc = ''; showAddClass = false;
			invalidateAll();
		}
		addingClass = false;
	}

	const inputClass = 'px-3 py-1.5 border border-stone-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400';
</script>

<div class="bg-white rounded-lg border border-stone-200 p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-sm font-semibold text-stone-800">Inflection System</h3>
		<div class="flex gap-2">
			<button onclick={() => showAddDim = !showAddDim} class="text-xs text-amber-700 hover:text-amber-900 hover:underline">+ Dimension</button>
			<button onclick={() => showAddClass = !showAddClass} class="text-xs text-amber-700 hover:text-amber-900 hover:underline">+ Class</button>
		</div>
	</div>

	<!-- Add dimension form -->
	{#if showAddDim}
		<form onsubmit={addDimension} class="p-3 bg-stone-50 rounded-lg border border-stone-200 mb-3 space-y-2">
			<div class="text-xs font-medium text-stone-500 mb-1">New dimension</div>
			<div class="flex gap-2 flex-wrap">
				<select bind:value={newDimPos} class={inputClass}>
					{#each PARTS_OF_SPEECH as pos}
						<option value={pos}>{pos}</option>
					{/each}
				</select>
				<input type="text" bind:value={newDimName} placeholder="Name (e.g. Case)" required class="flex-1 min-w-[120px] {inputClass}" />
				<input type="number" bind:value={newDimSort} class="w-16 {inputClass}" title="Sort order (0=rows, 1=columns)" />
			</div>
			<input type="text" bind:value={newDimValues} placeholder="Values, comma-separated (e.g. nominative, accusative, genitive, dative)" required class="w-full {inputClass}" />
			<div class="flex gap-2">
				<button type="submit" disabled={addingDim} class="px-3 py-1 bg-amber-600 text-white text-xs rounded-md hover:bg-amber-700 disabled:opacity-50">Add</button>
				<button type="button" onclick={() => showAddDim = false} class="text-xs text-stone-400">Cancel</button>
			</div>
		</form>
	{/if}

	<!-- Add class form -->
	{#if showAddClass}
		<form onsubmit={addClass} class="p-3 bg-stone-50 rounded-lg border border-stone-200 mb-3 space-y-2">
			<div class="text-xs font-medium text-stone-500 mb-1">New paradigm class</div>
			<div class="flex gap-2 flex-wrap">
				<select bind:value={newClassPos} class={inputClass}>
					{#each PARTS_OF_SPEECH as pos}
						<option value={pos}>{pos}</option>
					{/each}
				</select>
				<input type="text" bind:value={newClassName} placeholder="Name (e.g. Class 1 Regular)" required class="flex-1 min-w-[150px] {inputClass}" />
			</div>
			<input type="text" bind:value={newClassDesc} placeholder="Description (optional)" class="w-full {inputClass}" />
			<div class="flex gap-2">
				<button type="submit" disabled={addingClass} class="px-3 py-1 bg-amber-600 text-white text-xs rounded-md hover:bg-amber-700 disabled:opacity-50">Add</button>
				<button type="button" onclick={() => showAddClass = false} class="text-xs text-stone-400">Cancel</button>
			</div>
		</form>
	{/if}

	<!-- Existing dimensions grouped by POS -->
	{#if dimensions.length > 0}
		<div class="space-y-3">
			{#each [...grouped().entries()] as [pos, dims]}
				<div>
					<div class="text-xs font-medium text-stone-500 mb-1">{pos}</div>
					<div class="space-y-1">
						{#each dims as dim}
							<div class="flex items-center gap-2 text-sm group">
								<span class="font-medium text-stone-700">{dim.name}</span>
								<span class="text-stone-400 text-xs">[{dim.dimValues.join(', ')}]</span>
								<span class="text-stone-300 text-xs">sort: {dim.sortOrder}</span>
								<button onclick={() => deleteDimension(dim.id)} class="text-red-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
							</div>
						{/each}
					</div>

					<!-- Classes for this POS -->
					{#if classesGrouped().has(pos)}
						<div class="mt-1 ml-3">
							{#each classesGrouped().get(pos) || [] as cls}
								<div class="flex items-center gap-2 text-xs text-stone-500">
									<span class="text-amber-700 font-medium">{cls.name}</span>
									{#if cls.description}
										<span class="text-stone-400">— {cls.description}</span>
									{/if}
									<a href="/api/languages/{languageSlug}/inflections/classes/{cls.id}" target="_blank" class="text-stone-300 hover:text-stone-500">[rules]</a>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-xs text-stone-400">No inflection dimensions defined yet. Add dimensions to enable declension/conjugation tables.</p>
	{/if}
</div>
