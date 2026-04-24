<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'
	import Dialog from '$lib/components/ui/Dialog.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import IpaPicker from './IpaPicker.svelte'
	import { type IpaEntry } from '$lib/data/ipa-chart.js'
	import Plus from 'phosphor-svelte/lib/Plus'
	import Trash from 'phosphor-svelte/lib/Trash'
	import ArrowUp from 'phosphor-svelte/lib/ArrowUp'
	import ArrowDown from 'phosphor-svelte/lib/ArrowDown'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple'

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
	}: {
		languageSlug: string
		initial: Phoneme[]
	} = $props()

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
	let pickerType = $state<'consonant' | 'vowel'>('consonant')
	let manualOpen = $state(false)
	let editingId = $state<number | null>(null)
	let draft = $state<Draft>(emptyDraft())
	let saving = $state(false)
	let errorMessage = $state('')
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const consonants = $derived(phonemes.filter(p => p.type === 'consonant'))
	const vowels = $derived(phonemes.filter(p => p.type === 'vowel'))
	const other = $derived(phonemes.filter(p => p.type !== 'consonant' && p.type !== 'vowel'))

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

	function openPicker(type: 'consonant' | 'vowel') {
		pickerType = type
		pickerOpen = true
	}

	function openManual(type: 'consonant' | 'vowel' | 'diphthong' | 'special') {
		draft = emptyDraft(type)
		editingId = null
		manualOpen = true
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
			const res = await fetch(`/api/languages/${languageSlug}/phonemes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})
			if (!res.ok) {
				const error = await res.json().catch(() => null)
				errorMessage = error?.error ?? 'Failed to add phoneme'
				return
			}
			const created = await res.json() as Phoneme
			phonemes = [...phonemes, created]
		} finally {
			saving = false
		}
	}

	function startEdit(p: Phoneme) {
		editingId = p.id
		draft = draftFrom(p)
		manualOpen = true
	}

	async function saveManual() {
		errorMessage = ''
		saving = true
		try {
			const url = editingId
				? `/api/languages/${languageSlug}/phonemes/${editingId}`
				: `/api/languages/${languageSlug}/phonemes`
			const method = editingId ? 'PATCH' : 'POST'
			const body: Record<string, unknown> = {
				ipa: draft.ipa.trim(),
				type: draft.type,
				place: draft.place.trim() || null,
				manner: draft.manner.trim() || null,
				subtype: draft.subtype.trim() || null,
				voicing: draft.voicing || null,
				height: draft.height.trim() || null,
				backness: draft.backness.trim() || null,
				rounded: draft.rounded ?? null,
				notes: draft.notes.trim() || null,
			}
			const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
			if (!res.ok) {
				const error = await res.json().catch(() => null)
				errorMessage = error?.error ?? 'Failed to save phoneme'
				return
			}
			const saved = await res.json() as Phoneme
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
		const ok = await confirmDialog.confirm('Delete phoneme', `Delete /${p.ipa}/? This cannot be undone.`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/languages/${languageSlug}/phonemes/${p.id}`, { method: 'DELETE' })
		if (!res.ok) {
			const error = await res.json().catch(() => null)
			errorMessage = error?.error ?? 'Failed to delete phoneme'
			return
		}
		phonemes = phonemes.filter(x => x.id !== p.id)
	}

	async function move(p: Phoneme, direction: -1 | 1) {
		const sameType = phonemes.filter(x => x.type === p.type)
		const index = sameType.findIndex(x => x.id === p.id)
		const swapIndex = index + direction
		if (swapIndex < 0 || swapIndex >= sameType.length) return
		const other = sameType[swapIndex]
		const aOrder = p.sortOrder, bOrder = other.sortOrder
		const aRes = await fetch(`/api/languages/${languageSlug}/phonemes/${p.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sortOrder: bOrder }),
		})
		const bRes = await fetch(`/api/languages/${languageSlug}/phonemes/${other.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sortOrder: aOrder }),
		})
		if (aRes.ok && bRes.ok) {
			phonemes = phonemes
				.map((x) => {
					if (x.id === p.id) return { ...x, sortOrder: bOrder }
					if (x.id === other.id) return { ...x, sortOrder: aOrder }
					return x
				})
				.toSorted((a, b) => a.sortOrder - b.sortOrder)
		}
	}

	function featureSummary(p: Phoneme): string {
		const parts: string[] = []
		if (p.type === 'consonant') {
			if (p.voicing) parts.push(p.voicing)
			if (p.place) parts.push(p.place)
			if (p.manner) parts.push(p.manner)
		} else if (p.type === 'vowel') {
			if (p.height) parts.push(p.height)
			if (p.backness) parts.push(p.backness)
			if (p.rounded === true) parts.push('rounded')
			if (p.rounded === false) parts.push('unrounded')
		} else {
			if (p.place) parts.push(p.place)
			if (p.manner) parts.push(p.manner)
		}
		return parts.join(' ')
	}
</script>

{#if errorMessage}
	<div class="mb-3 px-3 py-2 bg-error-bg border border-error-border text-error-text text-sm">{errorMessage}</div>
{/if}

{#snippet groupTable(heading: string, list: Phoneme[], addType: 'consonant' | 'vowel' | null)}
	<section class="mb-8">
		<header class="flex items-center justify-between mb-2">
			<h3 class="text-heading font-medium capitalize">{heading} <span class="text-dim text-sm">({list.length})</span></h3>
			{#if addType}
				<div class="flex gap-2">
					<Button variant="secondary" size="sm" onclick={() => openPicker(addType)}><Plus size={14} weight="bold" />From IPA chart</Button>
					<Button variant="ghost" size="sm" onclick={() => openManual(addType)}>Custom…</Button>
				</div>
			{/if}
		</header>
		{#if list.length === 0}
			<p class="text-dim text-sm italic">No {heading.toLowerCase()} defined yet.</p>
		{:else}
			<table class="w-full text-sm border border-border-subtle">
				<thead>
					<tr class="bg-muted text-heading">
						<th class="px-2 py-1 text-left font-medium w-16">IPA</th>
						<th class="px-2 py-1 text-left font-medium">Features</th>
						<th class="px-2 py-1 text-left font-medium">Notes</th>
						<th class="px-2 py-1 w-32"></th>
					</tr>
				</thead>
				<tbody>
					{#each list as p, index}
						<tr class="border-t border-border-subtle">
							<td class="px-2 py-1 font-serif text-base">{p.ipa}</td>
							<td class="px-2 py-1 text-body text-sm">{featureSummary(p)}</td>
							<td class="px-2 py-1 text-dim text-xs">{p.notes ?? ''}</td>
							<td class="px-2 py-1 text-right">
								<div class="inline-flex items-center gap-1">
									<button class="p-1 text-dim hover:text-accent" disabled={index === 0} onclick={() => move(p, -1)} title="Move up"><ArrowUp size={14} /></button>
									<button class="p-1 text-dim hover:text-accent" disabled={index === list.length - 1} onclick={() => move(p, 1)} title="Move down"><ArrowDown size={14} /></button>
									<button class="p-1 text-dim hover:text-accent" onclick={() => startEdit(p)} title="Edit"><PencilSimple size={14} /></button>
									<button class="p-1 text-dim hover:text-error" onclick={() => handleDelete(p)} title="Delete"><Trash size={14} /></button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
{/snippet}

{@render groupTable('Consonants', consonants, 'consonant')}
{@render groupTable('Vowels', vowels, 'vowel')}
{#if other.length > 0}
	{@render groupTable('Other', other, null)}
{/if}

<IpaPicker bind:open={pickerOpen} onpick={handlePick} />

<Dialog bind:open={manualOpen} title={editingId ? 'Edit phoneme' : 'Custom phoneme'}>
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
			<Input label="Subtype (optional, for sub-rows)" bind:value={draft.subtype} />
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

		<div class="flex justify-end gap-2 pt-2">
			<Button variant="secondary" onclick={() => manualOpen = false}>Cancel</Button>
			<Button onclick={saveManual} loading={saving}>{editingId ? 'Save' : 'Add'}</Button>
		</div>
	</div>
</Dialog>

<ConfirmDialog bind:this={confirmDialog} />
