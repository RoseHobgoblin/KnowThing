<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import PhonemeGrid from './PhonemeGrid.svelte'
	import {
		PHONEME_TYPES, CONSONANT_PLACES, CONSONANT_MANNERS,
		VOWEL_HEIGHTS, VOWEL_BACKNESSES, VOICING_OPTIONS,
	} from '$lib/wordbook/phoneme-types.js'

	type Phoneme = {
		id: number
		ipa: string
		type: string
		place?: string | null
		manner?: string | null
		subtype?: string | null
		voicing?: string | null
		height?: string | null
		backness?: string | null
		rounded?: boolean | null
		notes?: string | null
		sortOrder: number
	}

	let { languageSlug, phonemes = [] }: {
		languageSlug: string
		phonemes: Phoneme[]
	} = $props()

	const consonants = $derived(phonemes.filter(p => p.type === 'consonant'))
	const vowels = $derived(phonemes.filter(p => p.type === 'vowel' || p.type === 'diphthong'))
	const specials = $derived(phonemes.filter(p => p.type === 'special'))

	// Add phoneme form
	let showAdd = $state(false)
	let adding = $state(false)
	let newIpa = $state('')
	let newType = $state<string>('consonant')
	let newPlace = $state('')
	let newManner = $state('')
	let newSubtype = $state('')
	let newVoicing = $state('')
	let newHeight = $state('')
	let newBackness = $state('')
	let newRounded = $state(false)
	let newNotes = $state('')

	function resetForm() {
		newIpa = ''; newType = 'consonant'; newPlace = ''; newManner = ''
		newSubtype = ''; newVoicing = ''; newHeight = ''; newBackness = ''
		newRounded = false; newNotes = ''
	}

	async function addPhoneme(e: SubmitEvent) {
		e.preventDefault()
		if (!newIpa.trim()) return
		adding = true
		const res = await fetch(`/api/languages/${languageSlug}/phonemes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				ipa: newIpa.trim(),
				type: newType,
				place: newPlace || undefined,
				manner: newManner || undefined,
				subtype: newSubtype || undefined,
				voicing: newVoicing || undefined,
				height: newHeight || undefined,
				backness: newBackness || undefined,
				rounded: newRounded,
				notes: newNotes || undefined,
			}),
		})
		if (res.ok) {
			resetForm()
			showAdd = false
			invalidateAll()
		}
		adding = false
	}

	async function deletePhoneme(id: number) {
		if (!confirm('Delete this phoneme?')) return
		await fetch(`/api/languages/${languageSlug}/phonemes/${id}`, { method: 'DELETE' })
		invalidateAll()
	}

	const inputClass = 'px-3 py-1.5 border border-border-strong rounded-lg text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent'
</script>

<div class="bg-surface rounded-lg border border-border p-4">
	<div class="flex items-center justify-between mb-3">
		<h3 class="text-sm font-semibold text-body">Phoneme Inventory</h3>
		<button onclick={() => showAdd = !showAdd} class="text-xs text-link hover:text-link-hover hover:underline">+ Phoneme</button>
	</div>

	<!-- Add form -->
	{#if showAdd}
		<form onsubmit={addPhoneme} class="p-3 bg-page rounded-lg border border-border mb-4 space-y-2">
			<div class="text-xs font-medium text-dim mb-1">New phoneme</div>

			<div class="flex gap-2 flex-wrap">
				<input type="text" bind:value={newIpa} placeholder="IPA (e.g. p, θ, ks)" required class="w-24 font-mono {inputClass}" />
				<select bind:value={newType} class={inputClass}>
					{#each PHONEME_TYPES as t}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</div>

			{#if newType === 'consonant'}
				<div class="flex gap-2 flex-wrap">
					<select bind:value={newPlace} class={inputClass}>
						<option value="">Place...</option>
						{#each CONSONANT_PLACES as p}
							<option value={p}>{p}</option>
						{/each}
					</select>
					<select bind:value={newManner} class={inputClass}>
						<option value="">Manner...</option>
						{#each CONSONANT_MANNERS as m}
							<option value={m}>{m}</option>
						{/each}
					</select>
					<select bind:value={newVoicing} class={inputClass}>
						<option value="">Voicing...</option>
						{#each VOICING_OPTIONS as v}
							<option value={v}>{v}</option>
						{/each}
					</select>
					<input type="text" bind:value={newSubtype} placeholder="Subtype (optional)" class="w-36 {inputClass}" />
				</div>
			{:else if newType === 'vowel' || newType === 'diphthong'}
				<div class="flex gap-2 flex-wrap">
					<select bind:value={newHeight} class={inputClass}>
						<option value="">Height...</option>
						{#each VOWEL_HEIGHTS as h}
							<option value={h}>{h}</option>
						{/each}
					</select>
					<select bind:value={newBackness} class={inputClass}>
						<option value="">Backness...</option>
						{#each VOWEL_BACKNESSES as b}
							<option value={b}>{b}</option>
						{/each}
					</select>
					<label class="flex items-center gap-1.5 text-sm text-secondary">
						<input type="checkbox" bind:checked={newRounded} />
						Rounded
					</label>
				</div>
			{/if}

			<input type="text" bind:value={newNotes} placeholder="Notes / allophonic rule (optional)" class="w-full {inputClass}" />

			<div class="flex gap-2">
				<button type="submit" disabled={adding} class="
					px-3 py-1 bg-accent text-surface text-xs rounded-md
					hover:bg-accent-hover disabled:opacity-50
				">{adding ? 'Adding...' : 'Add'}</button>
				<button type="button" onclick={() => { showAdd = false; resetForm() }} class="text-xs text-faint">Cancel</button>
			</div>
		</form>
	{/if}

	<!-- Consonants -->
	{#if consonants.length > 0}
		<div class="mb-4">
			<div class="text-xs font-semibold text-dim uppercase tracking-wide mb-2">Consonants</div>
			<PhonemeGrid phonemes={consonants} type="consonant" />

			<div class="mt-2 space-y-0.5">
				{#each consonants as p}
					<div class="flex items-center gap-2 text-xs group">
						<span class="font-mono text-body w-8">{p.ipa}</span>
						<span class="text-faint capitalize">{[p.voicing, p.place, p.manner].filter(Boolean).join(' ')}</span>
						{#if p.subtype}<span class="text-faint">({p.subtype})</span>{/if}
						<button onclick={() => deletePhoneme(p.id)} class="
							text-red-400 opacity-0 transition-opacity
							hover:text-red-600 group-hover:opacity-100
						">×</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Vowels -->
	{#if vowels.length > 0}
		<div class="mb-4">
			<div class="text-xs font-semibold text-dim uppercase tracking-wide mb-2">Vowels</div>
			<PhonemeGrid phonemes={vowels} type="vowel" />

			<div class="mt-2 space-y-0.5">
				{#each vowels as p}
					<div class="flex items-center gap-2 text-xs group">
						<span class="font-mono text-body w-8">{p.ipa}</span>
						<span class="text-faint capitalize">{[p.height, p.backness, p.rounded ? 'rounded' : null].filter(Boolean).join(' ')}</span>
						<button onclick={() => deletePhoneme(p.id)} class="
							text-red-400 opacity-0 transition-opacity
							hover:text-red-600 group-hover:opacity-100
						">×</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Special -->
	{#if specials.length > 0}
		<div class="mb-2">
			<div class="text-xs font-semibold text-dim uppercase tracking-wide mb-1">Special</div>
			<div class="space-y-0.5">
				{#each specials as p}
					<div class="flex items-center gap-2 text-xs group">
						<span class="font-mono text-body w-8">{p.ipa}</span>
						{#if p.notes}<span class="text-faint">{p.notes}</span>{/if}
						<button onclick={() => deletePhoneme(p.id)} class="
							text-red-400 opacity-0 transition-opacity
							hover:text-red-600 group-hover:opacity-100
						">×</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if phonemes.length === 0}
		<p class="text-xs text-faint">No phonemes defined yet. Add phonemes to build a sound inventory.</p>
	{/if}
</div>
