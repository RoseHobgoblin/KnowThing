<script lang="ts">
	import type { PageData } from './$types.js';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let slug = $state('');
	let nativeName = $state('');
	let script = $state('Latin');
	let family = $state('');
	let color = $state('#d97706');
	let description = $state('');
	let pageSlug = $state('');
	let parentLanguageId = $state<number | null>(null);
	let languageType = $state('language');
	let submitting = $state(false);
	let error = $state('');

	// Auto-generate slug from name
	function updateSlug() {
		if (!slug || slug === slugify(name.slice(0, -1))) {
			slug = slugify(name);
		}
	}

	function slugify(s: string): string {
		return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim() || !slug.trim()) {
			error = 'Name and slug are required';
			return;
		}

		error = '';
		submitting = true;

		try {
			const res = await fetch('/api/languages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					slug: slug.trim(),
					nativeName: nativeName.trim() || null,
					script: script.trim() || 'Latin',
					family: family.trim() || null,
					color: color || '#d97706',
					description: description.trim() || null,
					pageSlug: pageSlug.trim() || null,
					parentLanguageId: parentLanguageId || null,
					languageType
				})
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || 'Failed to create language');
			}

			const lang = await res.json();
			goto(`/wordbook/${lang.slug}`);
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
	<title>Add Language — Wordbook — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-stone-900 mb-1">Add a Language</h1>
		<p class="text-sm text-stone-500">Register a new language for the Wordbook.</p>
	</div>

	<div class="bg-white rounded-lg border border-stone-200 p-6">
		<form onsubmit={handleSubmit} class="space-y-4">
			{#if error}
				<div class="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="name" class={labelClass}>Name <span class="text-red-500">*</span></label>
					<input id="name" type="text" bind:value={name} oninput={updateSlug} required class={inputClass} placeholder="Oncheran" />
				</div>
				<div>
					<label for="slug" class={labelClass}>Slug <span class="text-red-500">*</span></label>
					<input id="slug" type="text" bind:value={slug} required class={inputClass} placeholder="oncheran" />
				</div>
				<div>
					<label for="native" class={labelClass}>Native Name</label>
					<input id="native" type="text" bind:value={nativeName} class={inputClass} placeholder="Ontsserako" />
				</div>
				<div>
					<label for="parent" class={labelClass}>Parent Language</label>
					<select id="parent" bind:value={parentLanguageId} class={inputClass}>
						<option value={null}>None (root language)</option>
						{#each data.existingLanguages as lang}
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
					<label for="family" class={labelClass}>
						Family
						{#if languageType === 'proto'}
							<span class="text-red-500">*</span>
						{:else}
							<span class="text-xs text-stone-400">(optional — inherits from parent)</span>
						{/if}
					</label>
					<input id="family" type="text" bind:value={family} class={inputClass}
						required={languageType === 'proto'}
						placeholder={languageType === 'proto' ? 'e.g. Mirish' : 'Leave blank to inherit from parent'} />
				</div>
				<div>
					<label for="script" class={labelClass}>Script</label>
					<input id="script" type="text" bind:value={script} class={inputClass} placeholder="Latin" />
				</div>
				<div>
					<label for="color" class={labelClass}>Accent Color</label>
					<div class="flex gap-2 items-center">
						<input id="color" type="color" bind:value={color} class="w-10 h-10 rounded border border-stone-300 cursor-pointer" />
						<input type="text" bind:value={color} class={inputClass} placeholder="#d97706" />
					</div>
				</div>
			</div>

			<div>
				<label for="pageSlug" class={labelClass}>Wiki Article <span class="text-xs text-stone-400">(slug)</span></label>
				<input id="pageSlug" type="text" bind:value={pageSlug} class={inputClass} placeholder="oncheran_language" />
			</div>

			<div>
				<label for="desc" class={labelClass}>Description</label>
				<textarea id="desc" bind:value={description} rows={3} class={inputClass} placeholder="A brief description of this language..."></textarea>
			</div>

			<div class="pt-2">
				<button
					type="submit"
					disabled={submitting}
					class="px-6 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
				>
					{submitting ? 'Creating...' : 'Create Language'}
				</button>
			</div>
		</form>
	</div>
</div>
