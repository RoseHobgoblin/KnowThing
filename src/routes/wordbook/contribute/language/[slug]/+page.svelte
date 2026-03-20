<script lang="ts">
	import type { PageData } from './$types.js';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let name = $state(data.language.name);
	let nativeName = $state(data.language.nativeName || '');
	let script = $state(data.language.script || 'Latin');
	let family = $state(data.language.family || '');
	let color = $state(data.language.color || '#d97706');
	let description = $state(data.language.description || '');
	let pageSlug = $state(data.language.pageSlug || '');
	let parentLanguageId = $state<number | null>(data.language.parentLanguageId || null);
	let languageType = $state(data.language.languageType || 'language');
	let submitting = $state(false);
	let error = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) { error = 'Name is required'; return; }

		error = '';
		submitting = true;
		try {
			const res = await fetch(`/api/languages/${data.language.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					nativeName: nativeName.trim() || undefined,
					script: script.trim() || 'Latin',
					family: family.trim() || undefined,
					color: color || '#d97706',
					description: description.trim() || undefined,
					pageSlug: pageSlug.trim() || undefined,
					parentLanguageId: parentLanguageId || null,
					languageType
				})
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || 'Failed to update');
			}
			goto(`/wordbook/${data.language.slug}`);
		} catch (e: any) {
			error = e.message;
		} finally {
			submitting = false;
		}
	}

	const inputClass = 'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400';
	const labelClass = 'block text-sm font-medium text-stone-700 mb-1';
</script>

<svelte:head>
	<title>Edit {data.language.name} — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-stone-900 mb-1">Edit Language: {data.language.name}</h1>
	</div>

	<div class="bg-white rounded-lg border border-stone-200 p-6">
		<form onsubmit={handleSubmit} class="space-y-4">
			{#if error}
				<div class="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="name" class={labelClass}>Name</label>
					<input id="name" type="text" bind:value={name} required class={inputClass} />
				</div>
				<div>
					<label for="native" class={labelClass}>Native Name</label>
					<input id="native" type="text" bind:value={nativeName} class={inputClass} />
				</div>
				<div>
					<label for="parent" class={labelClass}>Parent Language</label>
					<select id="parent" bind:value={parentLanguageId} class={inputClass}>
						<option value={null}>None (root language)</option>
						{#each data.otherLanguages as lang}
							<option value={lang.id}>{lang.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="type" class={labelClass}>Type</label>
					<select id="type" bind:value={languageType} class={inputClass}>
						<option value="language">Language</option>
						<option value="proto">Proto / Reconstructed</option>
						<option value="historical">Historical</option>
					</select>
				</div>
				<div>
					<label for="family" class={labelClass}>Family <span class="text-xs text-stone-400">(override)</span></label>
					<input id="family" type="text" bind:value={family} class={inputClass} />
				</div>
				<div>
					<label for="script" class={labelClass}>Script</label>
					<input id="script" type="text" bind:value={script} class={inputClass} />
				</div>
				<div>
					<label for="color" class={labelClass}>Accent Color</label>
					<div class="flex gap-2 items-center">
						<input id="color" type="color" bind:value={color} class="w-10 h-10 rounded border border-stone-300 cursor-pointer" />
						<input type="text" bind:value={color} class={inputClass} />
					</div>
				</div>
				<div>
					<label for="pageSlug" class={labelClass}>Wiki Article (slug)</label>
					<input id="pageSlug" type="text" bind:value={pageSlug} class={inputClass} />
				</div>
			</div>

			<div>
				<label for="desc" class={labelClass}>Description</label>
				<textarea id="desc" bind:value={description} rows={3} class={inputClass}></textarea>
			</div>

			<button type="submit" disabled={submitting} class="px-6 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
				{submitting ? 'Saving...' : 'Save Changes'}
			</button>
		</form>
	</div>
</div>
