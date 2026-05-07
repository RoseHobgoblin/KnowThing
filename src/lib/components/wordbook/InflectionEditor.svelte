<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import HelpBlock from '$lib/components/ui/HelpBlock.svelte'
	import { generateCellKeys, cellKeyLabel } from '$lib/wordbook/cell-keys.js'

	let {
		entryId,
		inflection,
		availableClasses = [],
		languageSlug = '',
		partOfSpeech = '',
	}: {
		entryId: number
		languageSlug?: string
		partOfSpeech?: string
		inflection: {
			dimensions: Array<{ id: number, name: string, values: string[], sortOrder: number }>
			forms: Record<string, string>
			overrides: Record<string, string>
			className: string | null
			stem: string | null
			hasInflection: boolean
		}
		availableClasses: Array<{ id: number, name: string, partOfSpeech: string }>
	} = $props()

	// Filter classes to only show those matching this word's POS
	const filteredClasses = $derived(
		partOfSpeech
			? availableClasses.filter(c => c.partOfSpeech === partOfSpeech)
			: availableClasses
	)

	let confirmDialog: ReturnType<typeof ConfirmDialog>

	let editing = $state(false)
	let selectedClassId = $state<number | null>(null)
	let stem = $state('')
	let overrides = $state<Record<string, string>>({})
	let saving = $state(false)
	let error = $state('')

	function startEditing() {
		selectedClassId = null
		stem = inflection.stem || ''
		overrides = { ...(inflection.overrides || {}) }

		if (inflection.className) {
			const match = filteredClasses.find(c => c.name === inflection.className)
			if (match) selectedClassId = match.id
		}

		editing = true
	}

	async function save() {
		saving = true
		error = ''

		try {
			const res = await fetch(`/api/wordbook/${entryId}/inflection`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					classId: selectedClassId || null,
					stem: stem.trim() || null,
					overrides: Object.fromEntries(
						Object.entries(overrides).filter(([_, v]) => v.trim()),
					),
				}),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to save')
			}

			pushSuccess('Inflection saved')
			editing = false
			invalidateAll()
		} catch (error_: any) {
			error = error_.message
			pushError(error_.message)
		} finally {
			saving = false
		}
	}

	async function removeInflection() {
		const ok = await confirmDialog.confirm('Remove inflection', 'Remove inflection data for this entry?', 'Remove', 'Cancel')
		if (!ok) return
		saving = true
		const res = await fetch(`/api/wordbook/${entryId}/inflection`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ classId: null, stem: null, overrides: {} }),
		})
		if (res.ok) {
			pushSuccess('Inflection removed')
		} else {
			pushError('Failed to remove inflection')
		}
		editing = false
		saving = false
		invalidateAll()
	}

	const cellKeys = $derived(
		generateCellKeys(inflection.dimensions.map(d => ({ values: d.values, sortOrder: d.sortOrder })))
	)

	const inputClass = 'px-2 py-1 border border-border-strong text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent'
</script>

{#if editing}
	<div class="mt-4 p-4 bg-raised border border-border space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<h4 class="text-xs font-medium uppercase tracking-wide text-dim">Set up inflection</h4>
				<HelpBlock title="?">
					<p>A <strong>paradigm class</strong> is a group of words that all inflect the same way (declension/conjugation pattern). Pick the class that matches this word, then enter its <strong>stem</strong> — the unchanging part the rules attach to.</p>
					<p>Cells where the language's regular rule doesn't fit can be filled in as <strong>overrides</strong> for irregular forms.</p>
					<p class="text-faint">Example: in a class with rule <code class="bg-surface-dim px-1 rounded">{'{'+'stem}us'}</code> for nominative singular, a word with stem <code class="bg-surface-dim px-1 rounded">equ</code> produces <code class="bg-surface-dim px-1 rounded">equus</code>. If this word is irregular and the actual form is <code class="bg-surface-dim px-1 rounded">equos</code>, set an override on the <code class="bg-surface-dim px-1 rounded">nom_sg</code> cell.</p>
				</HelpBlock>
			</div>
			<div class="flex gap-2">
				{#if inflection.hasInflection}
					<button onclick={removeInflection} class="text-xs text-error hover:underline">Remove</button>
				{/if}
				<button onclick={() => editing = false} class="text-xs text-faint hover:text-secondary">Cancel</button>
			</div>
		</div>

		{#if error}
			<div class="p-2 bg-error-bg border border-error-border text-error text-xs">{error}</div>
		{/if}

		<div class="flex gap-3 flex-wrap">
			<!-- Paradigm class -->
			<div class="flex-1 min-w-[200px]">
				<label class="block text-xs font-medium text-secondary mb-1">Paradigm Class</label>
				{#if filteredClasses.length > 0}
					<Select
						type="single"
						numeric
						bind:value={selectedClassId}
						placeholder="Manual (no class)"
						items={filteredClasses.map(cls => ({ value: String(cls.id), label: cls.name }))}
						containerClass="w-full"
					/>
					<p class="text-xs text-faint mt-1">Select a class to auto-generate forms from its rules.</p>
				{:else}
					<div class="p-2 bg-warning-bg border border-warning-border text-xs text-body">
						{#if availableClasses.length > 0}
							No paradigm classes for <strong>{partOfSpeech || 'this part of speech'}</strong>.
							Classes exist for other parts of speech — see
							<a href="/wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">Inflections</a>.
						{:else if inflection.dimensions.length > 0}
							No paradigm classes defined yet.
							<a href="/wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">Create a class</a>,
							then come back to assign it.
						{:else}
							No inflection system set up for this language.
							<a href="/wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">Add dimensions</a>
							(e.g. Case, Number) and paradigm classes first.
						{/if}
					</div>
				{/if}
			</div>

			<!-- Stem -->
			<div class="flex-1 min-w-[150px]">
				<label class="block text-xs font-medium text-secondary mb-1">Stem</label>
				<Input bind:value={stem} containerClass="w-full" placeholder="e.g. tsid" />
				<p class="text-xs text-faint mt-1">The base form that rules transform. Usually the word minus its ending.</p>
			</div>
		</div>

		<!-- Override grid -->
		{#if cellKeys.length > 0}
			<div>
				<label class="block text-xs font-medium text-secondary mb-1">
					Overrides
				</label>
				<p class="text-xs text-faint mb-2">Leave blank to use the class rule. Fill in to override with an irregular form.</p>
				<div class="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
					{#each cellKeys as key}
						{@const generated = inflection.forms[key] || ''}
						<div class="flex items-center gap-2">
							<span class="text-xs text-faint w-32 truncate" title={key}>{cellKeyLabel(key)}</span>
							<input
								type="text"
								value={overrides[key] || ''}
								oninput={(e) => {
									const value = (e.target as HTMLInputElement).value
									if (value.trim()) {
										overrides[key] = value
									} else {
										const { [key]: _, ...rest } = overrides
										overrides = rest
									}
								}}
								placeholder={generated || '—'}
								class="flex-1 {inputClass} text-xs {overrides[key] ? 'border-accent bg-accent-subtle' : ''}"
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<button
			onclick={save}
			disabled={saving}
			class="px-4 py-1.5 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50"
		>
			{saving ? 'Saving...' : 'Save Inflection'}
		</button>
	</div>
{:else if !inflection.hasInflection}
	<button onclick={startEditing} class="mt-3 text-sm text-link hover:text-link-hover hover:underline">
		+ Set up inflection
	</button>
{:else}
	<button onclick={startEditing} class="mt-1 text-xs text-faint hover:text-link hover:underline">
		Edit inflection
	</button>
{/if}

<ConfirmDialog bind:this={confirmDialog} />
