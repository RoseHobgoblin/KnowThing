<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import Dialog from '$lib/components/ui/Dialog.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import IpaPicker from './IpaPicker.svelte'
	import { type IpaEntry } from '$lib/data/ipa-chart.js'
	import { buildPhonemeGrid, cellKey, type PhonemeRow } from '$lib/renderer/structured/phoneme-grid.js'
	import Plus from 'phosphor-svelte/lib/PlusIcon'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimpleIcon'
	import Trash from 'phosphor-svelte/lib/TrashIcon'

	interface Phoneme {
		id: number
		languageId: number
		ipa: string
		type: string
		place: string | null
		manner: string | null
		subtype: string | null
		voicing: string | null
		height: string | null
		backness: string | null
		rounded: boolean | null
		notes: string | null
		sortOrder: number
	}

	let {
		languageSlug,
		initial,
		readOnly = false,
	}: {
		languageSlug: string
		initial: Phoneme[]
		readOnly?: boolean
	} = $props()

	// ────────────────────────────────────────────────────────────── draft state
	interface Draft {
		ipa: string
		type: string
		place: string
		manner: string
		subtype: string
		voicing: string
		height: string
		backness: string
		rounded: boolean | undefined
		notes: string
	}

	function emptyDraft(type: string = 'consonant'): Draft {
		return {
			ipa: '',
			type,
			place: '',
			manner: '',
			subtype: '',
			voicing: '',
			height: '',
			backness: '',
			rounded: undefined,
			notes: '',
		}
	}

	function draftFrom(p: Phoneme): Draft {
		return {
			ipa: p.ipa,
			type: p.type,
			place: p.place ?? '',
			manner: p.manner ?? '',
			subtype: p.subtype ?? '',
			voicing: p.voicing ?? '',
			height: p.height ?? '',
			backness: p.backness ?? '',
			rounded: p.rounded ?? undefined,
			notes: p.notes ?? '',
		}
	}

	let phonemes = $state<Phoneme[]>(initial)
	let pickerOpen = $state(false)
	let pickerFilter = $state<'consonant' | 'vowel'>('consonant')
	let manualOpen = $state(false)
	let editingId = $state<number | null>(null)
	let draft = $state<Draft>(emptyDraft())
	let saving = $state(false)
	let errorMessage = $state('')
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const consonants = $derived(phonemes.filter(p => p.type === 'consonant'))
	const vowels = $derived(phonemes.filter(p => p.type === 'vowel'))
	const otherPhonemes = $derived(phonemes.filter(p => p.type !== 'consonant' && p.type !== 'vowel'))

	const consonantGrid = $derived(buildPhonemeGrid(consonants as PhonemeRow[], 'consonant'))
	const vowelGrid = $derived(buildPhonemeGrid(vowels as PhonemeRow[], 'vowel'))

	const unplacedConsonants = $derived(consonants.filter(p => !p.place || !p.manner))
	const unplacedVowels = $derived(vowels.filter(p => !p.height || !p.backness))

	const VOICING_ITEMS = [
		{ value: '', label: '—' },
		{ value: 'voiceless', label: 'voiceless' },
		{ value: 'voiced', label: 'voiced' },
	]
	const TYPE_ITEMS = [
		{ value: 'consonant', label: 'consonant' },
		{ value: 'vowel', label: 'vowel' },
		{ value: 'diphthong', label: 'diphthong' },
		{ value: 'special', label: 'special' },
	]

	// ───────────────────────────────────────────────────────────────── actions
	function openPicker(kind: 'consonant' | 'vowel') {
		pickerFilter = kind
		pickerOpen = true
	}

	function openManual(type: string, prefill: Partial<Draft> = {}) {
		draft = { ...emptyDraft(type), ...prefill }
		editingId = null
		manualOpen = true
	}

	function openCell(
		kind: 'consonant' | 'vowel',
		existing: Phoneme | null,
		axes: { place?: string, manner?: string, height?: string, backness?: string },
	) {
		if (readOnly) return
		if (existing) {
			editingId = existing.id
			draft = draftFrom(existing)
			manualOpen = true
		} else {
			openManual(kind, axes)
		}
	}

	async function handlePick(entry: IpaEntry) {
		errorMessage = ''
		const body = {
			ipa: entry.symbol,
			type: entry.type,
			place: entry.place ?? null,
			manner: entry.manner ?? null,
			subtype: entry.subtype ?? null,
			voicing: entry.voicing ?? null,
			height: entry.height ?? null,
			backness: entry.backness ?? null,
			rounded: entry.rounded ?? null,
		}
		saving = true
		try {
			const response = await fetch(`/api/languages/${languageSlug}/phonemes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})
			if (!response.ok) {
				const error = await response.json().catch(() => null)
				errorMessage = error?.error ?? 'Failed to add phoneme'
				return
			}
			const created = await response.json() as Phoneme
			phonemes = [...phonemes, created]
		} finally {
			saving = false
		}
	}

	async function saveManual() {
		errorMessage = ''
		saving = true
		try {
			const url = editingId
				? `/api/languages/${languageSlug}/phonemes/${editingId}`
				: `/api/languages/${languageSlug}/phonemes`
			const method = editingId ? 'PATCH' : 'POST'
			// Wipe axis fields that don't apply to this type so changing
			// consonant → vowel (or back) doesn't leave stale data behind.
			const isConsonantish = draft.type === 'consonant' || draft.type === 'special' || draft.type === 'diphthong'
			const isVowel = draft.type === 'vowel'
			const body: Record<string, unknown> = {
				ipa: draft.ipa.trim(),
				type: draft.type,
				place: isConsonantish ? (draft.place.trim() || null) : null,
				manner: isConsonantish ? (draft.manner.trim() || null) : null,
				subtype: isConsonantish ? (draft.subtype.trim() || null) : null,
				voicing: isConsonantish ? (draft.voicing || null) : null,
				height: isVowel ? (draft.height.trim() || null) : null,
				backness: isVowel ? (draft.backness.trim() || null) : null,
				rounded: isVowel ? (draft.rounded ?? null) : null,
				notes: draft.notes.trim() || null,
			}
			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})
			if (!response.ok) {
				const error = await response.json().catch(() => null)
				errorMessage = error?.error ?? 'Failed to save phoneme'
				return
			}
			const saved = await response.json() as Phoneme
			if (editingId) {
				phonemes = phonemes.map(p => p.id === saved.id ? saved : p)
			} else {
				phonemes = [...phonemes, saved]
			}
			manualOpen = false
		} finally {
			saving = false
		}
	}

	async function handleDelete(p: Phoneme) {
		const ok = await confirmDialog.confirm(
			'Delete phoneme',
			`Delete /${p.ipa}/? This cannot be undone.`,
			'Delete',
			'Cancel',
		)
		if (!ok) return
		const response = await fetch(`/api/languages/${languageSlug}/phonemes/${p.id}`, { method: 'DELETE' })
		if (!response.ok) {
			const error = await response.json().catch(() => null)
			errorMessage = error?.error ?? 'Failed to delete phoneme'
			return
		}
		phonemes = phonemes.filter(x => x.id !== p.id)
		if (editingId === p.id) manualOpen = false
	}
</script>

{#if errorMessage}
	<div class="mb-4 px-3 py-2 bg-error-bg border border-error-border text-error-text text-sm">{errorMessage}</div>
{/if}

{#snippet inventorySection(
	label: string,
	kind: 'consonant' | 'vowel',
	grid: ReturnType<typeof buildPhonemeGrid>,
	unplaced: Phoneme[],
)}
	<section class="mb-8">
		<header class="flex items-center justify-between mb-3">
			<h2 class="text-lg font-semibold text-heading">{label}</h2>
			{#if !readOnly}
				<div class="flex gap-2">
					<Button variant="secondary" size="sm" onclick={() => openPicker(kind)}>
						<Plus size={14} weight="bold" /> IPA chart
					</Button>
					<Button variant="ghost" size="sm" onclick={() => openManual(kind)}>
						<Plus size={14} weight="bold" /> Custom
					</Button>
				</div>
			{/if}
		</header>

		{#if !grid || (grid.columns.length === 0 && unplaced.length === 0)}
			<div class="border border-border-subtle bg-raised px-4 py-8 text-center text-dim text-sm">
				No {label.toLowerCase()} defined yet.
				{#if !readOnly}
					<div class="mt-2">
						<button type="button" class="text-link hover:underline" onclick={() => openPicker(kind)}>
							Pick from the IPA chart
						</button>
						to get started.
					</div>
				{/if}
			</div>
		{:else if grid}
			<div class="overflow-x-auto border border-border-subtle">
				<table class="w-full text-sm">
					<thead>
						<tr>
							<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-left text-heading capitalize font-medium">
								{kind === 'consonant' ? 'Manner' : 'Height'}
							</th>
							{#each grid.columns as col (col)}
								<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-heading font-medium capitalize text-center">
									{col}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each grid.rows as row (row.header + (row.subtype ?? ''))}
							<tr>
								<th class="px-3 py-2 border-b border-r border-border-subtle bg-raised text-left font-medium capitalize text-body whitespace-nowrap">
									{row.header}{#if row.subtype}<span class="text-dim text-xs ml-1">({row.subtype})</span>{/if}
								</th>
								{#each grid.columns as col (col)}
									{@const list = grid.cells.get(cellKey(row, col)) ?? []}
									{@const axes = kind === 'consonant'
										? { manner: row.header, place: col }
										: { height: row.header, backness: col }}
									<td class="border-b border-r border-border-subtle p-0 align-middle text-center">
										{#if list.length > 0}
											<div class="flex flex-wrap gap-1 justify-center items-center px-2 py-1.5">
												{#each list as p (p.id)}
													<button
														type="button"
														class="phoneme-chip font-serif text-base px-2 py-0.5 rounded-sm transition-colors {readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-accent-subtle hover:text-accent'}"
														onclick={() => openCell(kind, p as Phoneme, axes)}
														title={p.notes ?? `${p.ipa} — edit`}
														disabled={readOnly}
													>
														{p.ipa}
														{#if p.notes?.trim()}<span class="text-dim text-xs align-top ml-0.5">*</span>{/if}
													</button>
												{/each}
												{#if !readOnly}
													<button
														type="button"
														class="text-faint transition-colors opacity-0 px-1 hover:text-accent group-hover:opacity-100"
														onclick={() => openCell(kind, null, axes)}
														title="Add another here"
													>
														<Plus size={12} weight="bold" />
													</button>
												{/if}
											</div>
										{:else if !readOnly}
											<button
												type="button"
												class="size-full min-h-8 px-2 py-1.5 text-faint transition-colors cursor-pointer hover:text-accent hover:bg-accent-subtle"
												onclick={() => openCell(kind, null, axes)}
												title="Add {row.header} {col}"
												aria-label="Add {row.header} {col}"
											>
												<Plus size={12} weight="bold" class="mx-auto opacity-60" />
											</button>
										{:else}
											<span class="block min-h-8"></span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if grid.footnotes.length > 0}
				<ol class="mt-2 text-xs text-dim space-y-0.5 list-none pl-2">
					{#each grid.footnotes as function_ (function_.index)}
						<li>
							<span class="font-mono text-faint">*</span>
							<span class="font-serif">{function_.ipa}</span>
							<span class="mx-1">·</span>
							<span>{function_.text}</span>
						</li>
					{/each}
				</ol>
			{/if}

			{#if unplaced.length > 0}
				<div class="mt-3 border-t border-border-subtle pt-2">
					<div class="text-xs text-dim mb-1.5">
						Unplaced — missing {kind === 'consonant' ? 'place or manner' : 'height or backness'}:
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each unplaced as p (p.id)}
							<button
								type="button"
								class="font-serif text-base px-2 py-0.5 border border-border-subtle rounded-sm transition-colors {readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-accent-subtle hover:text-accent hover:border-accent-border'}"
								onclick={() => openCell(kind, p as Phoneme, {})}
								disabled={readOnly}
							>
								{p.ipa}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</section>
{/snippet}

{@render inventorySection('Consonants', 'consonant', consonantGrid, unplacedConsonants)}
{@render inventorySection('Vowels', 'vowel', vowelGrid, unplacedVowels)}

{#if otherPhonemes.length > 0}
	<section class="mb-8">
		<header class="flex items-center justify-between mb-3">
			<h2 class="text-lg font-semibold text-heading">Other</h2>
			{#if !readOnly}
				<Button variant="ghost" size="sm" onclick={() => openManual('diphthong')}>
					<Plus size={14} weight="bold" /> Custom
				</Button>
			{/if}
		</header>
		<div class="flex flex-wrap gap-1.5">
			{#each otherPhonemes as p (p.id)}
				<button
					type="button"
					class="font-serif text-base px-2 py-0.5 border border-border-subtle rounded-sm transition-colors {readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-accent-subtle hover:text-accent hover:border-accent-border'}"
					onclick={() => openCell('consonant', p as Phoneme, {})}
					disabled={readOnly}
					title="{p.type}"
				>
					{p.ipa}
					<span class="text-faint text-xs ml-1">{p.type}</span>
				</button>
			{/each}
		</div>
	</section>
{/if}

<IpaPicker bind:open={pickerOpen} filter={pickerFilter} busy={saving} onpick={handlePick} />

<Dialog bind:open={manualOpen} title={editingId ? `Edit /${draft.ipa || '?'}/` : 'Add phoneme'}>
	<div class="space-y-3 pb-2">
		<div class="grid grid-cols-2 gap-3">
			<Input label="IPA" bind:value={draft.ipa} />
			<Select label="Type" type="single" items={TYPE_ITEMS} bind:value={draft.type} />
		</div>

		{#if draft.type === 'consonant' || draft.type === 'special' || draft.type === 'diphthong'}
			<div class="grid grid-cols-3 gap-3">
				<Input label="Place" bind:value={draft.place} />
				<Input label="Manner" bind:value={draft.manner} />
				<Select label="Voicing" type="single" items={VOICING_ITEMS} bind:value={draft.voicing} />
			</div>
			<Input label="Subtype (optional — for sub-rows like aspirated/tense)" bind:value={draft.subtype} />
		{/if}

		{#if draft.type === 'vowel'}
			<div class="grid grid-cols-3 gap-3">
				<Input label="Height" bind:value={draft.height} />
				<Input label="Backness" bind:value={draft.backness} />
				<div class="flex items-end pb-2">
					<Checkbox bind:value={draft.rounded} label="Rounded" />
				</div>
			</div>
		{/if}

		<Input label="Notes (footnote)" bind:value={draft.notes} />

		<div class="flex justify-between items-center pt-3 border-t border-border-subtle">
			<div>
				{#if editingId}
					<Button variant="danger" size="sm" onclick={async () => {
						const p = phonemes.find(x => x.id === editingId)
						if (p) await handleDelete(p)
					}}>
						<Trash size={14} weight="bold" /> Delete
					</Button>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="secondary" onclick={() => manualOpen = false}>Cancel</Button>
				<Button onclick={saveManual} loading={saving}>
					{#if editingId}
						<PencilSimple size={14} weight="bold" /> Save
					{:else}
						<Plus size={14} weight="bold" /> Add
					{/if}
				</Button>
			</div>
		</div>
	</div>
</Dialog>

<ConfirmDialog bind:this={confirmDialog} />
