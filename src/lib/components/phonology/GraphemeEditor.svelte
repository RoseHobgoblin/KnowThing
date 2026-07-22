<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Dialog from '$lib/components/ui/Dialog.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import PhonemeSequenceInput from './PhonemeSequenceInput.svelte'
	import { pushUndoable, pushError } from '$lib/notifications.svelte'
	import { cn } from '$lib/utils'
	import Plus from 'phosphor-svelte/lib/PlusIcon'
	import PencilSimple from 'phosphor-svelte/lib/PencilSimpleIcon'
	import Trash from 'phosphor-svelte/lib/TrashIcon'
	import Copy from 'phosphor-svelte/lib/CopyIcon'
	import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVerticalIcon'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'

	interface PhonemeLink {
		phonemeId: number
		ipa: string
		type: string
	}

	interface Grapheme {
		id: number
		languageId: number
		grapheme: string
		romanization: string | null
		environment: string | null
		notes: string | null
		sortOrder: number
		phonemes: PhonemeLink[]
	}

	interface PhonemeOption {
		id: number
		ipa: string
		type: string
	}

	let {
		languageSlug,
		initial,
		phonemeInventory,
		readOnly = false,
	}: {
		languageSlug: string
		initial: Grapheme[]
		phonemeInventory: PhonemeOption[]
		readOnly?: boolean
	} = $props()

	interface Draft {
		grapheme: string
		phonemeIds: number[]
		romanization: string
		environment: string
		notes: string
	}

	function emptyDraft(): Draft {
		return { grapheme: '', phonemeIds: [], romanization: '', environment: '', notes: '' }
	}

	function draftFrom(g: Grapheme): Draft {
		return {
			grapheme: g.grapheme,
			phonemeIds: g.phonemes.map(p => p.phonemeId),
			romanization: g.romanization ?? '',
			environment: g.environment ?? '',
			notes: g.notes ?? '',
		}
	}

	let graphemes = $state<Grapheme[]>(initial)
	let dialogOpen = $state(false)
	let editingId = $state<number | null>(null)
	let draft = $state<Draft>(emptyDraft())
	let draftSnapshot = $state<Draft>(emptyDraft())
	let errorMessage = $state('')
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const dirty = $derived(JSON.stringify(draft) !== JSON.stringify(draftSnapshot))

	let dragIndex = $state<number | null>(null)
	const saveMutation = createMutation(() => ({
		mutationFn: ({ id, body }: { id: number | null, body: Record<string, unknown> }) =>
			api<Grapheme>(id ? 'PATCH' : 'POST', id
				? `/api/languages/${languageSlug}/graphemes/${id}`
				: `/api/languages/${languageSlug}/graphemes`, body),
	}))
	const deleteMutation = createMutation(() => ({
		mutationFn: (id: number) => api('DELETE', `/api/languages/${languageSlug}/graphemes/${id}`),
	}))
	const restoreMutation = createMutation(() => ({
		mutationFn: (body: Record<string, unknown>) =>
			api<Grapheme>('POST', `/api/languages/${languageSlug}/graphemes`, body),
	}))
	const reorderMutation = createMutation(() => ({
		mutationFn: (order: number[]) =>
			api('POST', `/api/languages/${languageSlug}/graphemes/reorder`, { order }),
	}))
	const saving = $derived(saveMutation.isPending || restoreMutation.isPending)

	function openAdd() {
		draft = emptyDraft()
		draftSnapshot = $state.snapshot(draft) as Draft
		editingId = null
		dialogOpen = true
	}

	function openEdit(g: Grapheme) {
		if (readOnly) return
		editingId = g.id
		draft = draftFrom(g)
		draftSnapshot = $state.snapshot(draft) as Draft
		dialogOpen = true
	}

	async function saveDraft() {
		errorMessage = ''
		try {
			const body = {
				grapheme: draft.grapheme,
				phonemeIds: draft.phonemeIds,
				romanization: draft.romanization.trim() || null,
				environment: draft.environment.trim() || null,
				notes: draft.notes.trim() || null,
			}
			const saved = await saveMutation.mutateAsync({ id: editingId, body })
			if (editingId) {
				graphemes = graphemes.map(g => g.id === saved.id ? saved : g)
			} else {
				graphemes = [...graphemes, saved]
			}
			draftSnapshot = $state.snapshot(draft) as Draft
			dialogOpen = false
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to save grapheme'
		}
	}

	function duplicate() {
		editingId = null
	}

	async function cancelDialog() {
		if (dirty) {
			const ok = await confirmDialog.confirm(
				'Discard changes?',
				'You have unsaved changes to this grapheme. Close without saving?',
				'Discard',
				'Keep editing',
			)
			if (!ok) return
		}
		dialogOpen = false
	}

	function onDialogKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			const target = event.target as HTMLElement | null
			if (target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return
			event.preventDefault()
			if (!saving && draft.grapheme.trim()) saveDraft()
		}
	}

	async function handleDelete(g: Grapheme) {
		try {
			await deleteMutation.mutateAsync(g.id)
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to delete grapheme'
			return
		}

		const snapshot: Grapheme = { ...g }
		graphemes = graphemes.filter(x => x.id !== g.id)
		if (editingId === g.id) dialogOpen = false

		pushUndoable(
			`Deleted "${g.grapheme}"`,
			async () => {
				try {
					const restored = await restoreMutation.mutateAsync({
						grapheme: snapshot.grapheme,
						phonemeIds: snapshot.phonemes.map(p => p.phonemeId),
						romanization: snapshot.romanization,
						environment: snapshot.environment,
						notes: snapshot.notes,
						sortOrder: snapshot.sortOrder,
					})
					graphemes = [...graphemes, restored]
				} catch {
					pushError(`Couldn't restore "${snapshot.grapheme}"`)
				}
			},
			() => {},
		)
	}

	async function commitReorder(nextOrder: number[]) {
		const previous = [...graphemes]
		graphemes = nextOrder
			.map(id => previous.find(g => g.id === id)!)
			.filter(Boolean)
		try {
			await reorderMutation.mutateAsync(nextOrder)
		} catch (error) {
			graphemes = previous
			errorMessage = error instanceof Error ? error.message : 'Failed to reorder'
		}
	}

	function onRowDragStart(index: number, event: DragEvent) {
		dragIndex = index
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move'
			event.dataTransfer.setData('text/plain', String(index))
		}
	}

	function onRowDragOver(event: DragEvent) {
		event.preventDefault()
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
	}

	function onRowDragEnd() {
		// Cancelled drop (Esc / outside any droppable) — clear visual state.
		dragIndex = null
	}

	function onRowDrop(index: number, event: DragEvent) {
		event.preventDefault()
		const from = dragIndex
		dragIndex = null
		if (from == null || from === index) return
		const next = [...graphemes]
		const [moved] = next.splice(from, 1)
		next.splice(index, 0, moved)
		commitReorder(next.map(g => g.id))
	}

	function ipaDisplay(g: Grapheme): string {
		if (g.phonemes.length === 0) return '—'
		return `/${g.phonemes.map(p => p.ipa).join('')}/`
	}
</script>

{#if errorMessage}
	<div class="mb-4 px-3 py-2 bg-error-bg border border-error-border text-error-text text-sm">{errorMessage}</div>
{/if}

{#if graphemes.length === 0}
	<div class="bg-raised px-4 py-8 text-center text-dim text-sm">
		No graphemes defined yet. Add the first one to build the orthography.
		{#if !readOnly}
			<div class="mt-3">
				<Button size="sm" onclick={openAdd}>
					<Plus size={14} weight="bold" /> Add grapheme
				</Button>
			</div>
		{/if}
	</div>
{:else}
	<div class="overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr>
					<th class="w-8 px-1 py-2 border-b border-r border-border-subtle bg-muted"></th>
					<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-heading font-medium text-left">Script</th>
					<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-heading font-medium text-center w-4">→</th>
					<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-heading font-medium text-left">IPA</th>
					<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-heading font-medium text-left">Romanization</th>
					<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-heading font-medium text-left">Environment</th>
					<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-heading font-medium text-left">Notes</th>
					<th class="px-3 py-2 border-b border-border-subtle bg-muted"></th>
				</tr>
			</thead>
			<tbody>
				{#each graphemes as g, index (g.id)}
					{@const cellClick = readOnly ? undefined : () => openEdit(g)}
					{@const cellKeydown = readOnly
						? undefined
						: (event: KeyboardEvent) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault()
								openEdit(g)
							}
						}}
					{@const cellAttributes = readOnly
						? 'px-3 py-1.5 border-b border-r border-border-subtle'
						: 'px-3 py-1.5 border-b border-r border-border-subtle cursor-pointer'}
					<tr
						class="transition-colors hover:bg-accent-subtle/40"
						class:opacity-50={dragIndex === index}
						ondragover={onRowDragOver}
						ondrop={event => onRowDrop(index, event)}
						ondragend={onRowDragEnd}
					>
						<td
							class={cn('px-1 py-1.5 border-b border-r border-border-subtle text-center text-secondary', !readOnly && 'cursor-grab')}
							draggable={readOnly ? 'false' : 'true'}
							ondragstart={event => onRowDragStart(index, event)}
							title={readOnly ? undefined : 'Drag to reorder'}
						>
							<DotsSixVertical size={14} />
						</td>
						<td class={cn(cellAttributes, 'font-serif text-base')} onclick={cellClick} onkeydown={cellKeydown} role={readOnly ? undefined : 'button'} tabindex={readOnly ? undefined : 0}>
							{g.grapheme}
						</td>
						<td class="px-1 py-1.5 border-b border-r border-border-subtle text-secondary text-center">→</td>
						<td class={cn(cellAttributes, 'font-serif', g.phonemes.length === 0 && 'text-dim')} onclick={cellClick} onkeydown={cellKeydown} role={readOnly ? undefined : 'button'} tabindex={readOnly ? undefined : -1}>
							{ipaDisplay(g)}
						</td>
						<td class={cn(cellAttributes, 'text-secondary')} onclick={cellClick} onkeydown={cellKeydown} role={readOnly ? undefined : 'button'} tabindex={readOnly ? undefined : -1}>{g.romanization ?? ''}</td>
						<td class={cn(cellAttributes, 'text-secondary')} onclick={cellClick} onkeydown={cellKeydown} role={readOnly ? undefined : 'button'} tabindex={readOnly ? undefined : -1}>{g.environment ?? ''}</td>
						<td class={cn('px-3 py-1.5 border-b border-r border-border-subtle text-dim text-xs max-w-xs truncate', !readOnly && 'cursor-pointer')} title={g.notes ?? undefined} onclick={cellClick} onkeydown={cellKeydown} role={readOnly ? undefined : 'button'} tabindex={readOnly ? undefined : -1}>
							{g.notes ?? ''}
						</td>
						<td class="px-2 py-1.5 border-b border-border-subtle text-right">
							{#if !readOnly}
								<button
									type="button"
									class="text-secondary px-1 hover:text-accent"
									onclick={() => openEdit(g)}
									aria-label="Edit grapheme"
									title="Edit"
								>
									<PencilSimple size={14} weight="bold" />
								</button>
								<button
									type="button"
									class="text-secondary px-1 hover:text-error"
									onclick={() => handleDelete(g)}
									aria-label="Delete grapheme"
									title="Delete"
								>
									<Trash size={14} weight="bold" />
								</button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if !readOnly}
		<div class="mt-3 flex justify-center">
			<Button size="sm" variant="secondary" onclick={openAdd}>
				<Plus size={14} weight="bold" /> Add grapheme
			</Button>
		</div>
	{/if}
{/if}

<Dialog
	bind:open={dialogOpen}
	title={editingId ? `Edit "${draft.grapheme || '?'}"` : 'Add grapheme'}
	unclosable={dirty || saving}
>
	<div class="space-y-3 pb-2" role="presentation" onkeydown={onDialogKeydown}>
		<Input label="Script (case-sensitive; digraphs and PUA characters OK)" bind:value={draft.grapheme} />

		<div>
			<div class="text-xs uppercase tracking-wider text-dim mb-1.5">Phoneme sequence</div>
			<PhonemeSequenceInput bind:value={draft.phonemeIds} options={phonemeInventory} />
		</div>

		<div class="grid grid-cols-2 gap-3">
			<Input label="Romanization (optional)" bind:value={draft.romanization} />
			<Input
				label="Environment"
				bind:value={draft.environment}
				hint="e.g. 'before front vowels', 'word-initial', 'isolated form'"
			/>
		</div>

		<Input label="Notes (footnote)" bind:value={draft.notes} />

		{#if dirty}
			<div class="text-xs text-warning bg-warning-bg border border-warning-border px-2 py-1">
				Unsaved changes — Save to commit, or Cancel to discard.
			</div>
		{/if}

		<div class="flex justify-between items-center pt-3 border-t border-border-subtle">
			<div class="flex gap-2">
				{#if editingId}
					<Button variant="danger" size="sm" onclick={async () => {
						const g = graphemes.find(x => x.id === editingId)
						if (g) await handleDelete(g)
					}}>
						<Trash size={14} weight="bold" /> Delete
					</Button>
					<Button variant="secondary" size="sm" onclick={duplicate}>
						<Copy size={14} weight="bold" /> Duplicate
					</Button>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="secondary" onclick={cancelDialog}>Cancel</Button>
				<Button onclick={saveDraft} loading={saving} disabled={!draft.grapheme.trim()}>
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
