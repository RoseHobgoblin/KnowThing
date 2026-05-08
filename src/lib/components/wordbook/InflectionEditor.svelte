<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import WorkedInflectionExample from './WorkedInflectionExample.svelte'
	import { generateCellKeys, cellKeyLabel } from '$lib/wordbook/cell-keys.js'
	import { applyStem } from '$lib/wordbook/inflection-pattern.js'

	let {
		entryId,
		word = '',
		inflection,
		availableClasses = [],
		languageSlug = '',
		partOfSpeech = '',
	}: {
		entryId: number
		word?: string
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

	const filteredClasses = $derived(
		partOfSpeech
			? availableClasses.filter(c => c.partOfSpeech === partOfSpeech)
			: availableClasses,
	)

	let confirmDialog: ReturnType<typeof ConfirmDialog>

	let editing = $state(false)
	let selectedClassId = $state<number | null>(null)
	let stem = $state('')
	let overrides = $state<Record<string, string>>({})
	let saving = $state(false)
	let error = $state('')

	// Rules for the currently selected class — fetched on demand for live preview
	let selectedClassRules = $state<Record<string, string>>({})
	let loadingRules = $state(false)

	async function loadClassRules(classId: number | null) {
		if (classId === null) {
			selectedClassRules = {}
			return
		}
		loadingRules = true
		try {
			const response = await fetch(`/api/languages/${languageSlug}/inflections/classes/${classId}`)
			if (!response.ok) {
				selectedClassRules = {}
				return
			}
			const data = await response.json()
			const rules: Record<string, string> = {}
			for (const r of data.rules || []) rules[r.cellKey] = r.pattern
			selectedClassRules = rules
		} finally {
			loadingRules = false
		}
	}

	$effect(() => {
		if (editing) loadClassRules(selectedClassId)
	})

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
			const response = await fetch(`/api/wordbook/${entryId}/inflection`, {
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
			if (!response.ok) {
				const data = await response.json()
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
		const response = await fetch(`/api/wordbook/${entryId}/inflection`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ classId: null, stem: null, overrides: {} }),
		})
		if (response.ok) {
			pushSuccess('Inflection removed')
		} else {
			pushError('Failed to remove inflection')
		}
		editing = false
		saving = false
		invalidateAll()
	}

	const cellKeys = $derived(
		generateCellKeys(inflection.dimensions.map(d => ({ values: d.values, sortOrder: d.sortOrder }))),
	)

	// Smart stem placeholder: try to strip the longest non-{stem} suffix
	// from any rule pattern off the headword.
	const stemPlaceholder = $derived.by(() => {
		if (!word) return 'e.g. cat'
		const patterns = Object.values(selectedClassRules)
		if (patterns.length === 0) return word
		let best = word
		for (const pattern of patterns) {
			const idx = pattern.indexOf('{stem}')
			if (idx === -1) continue
			const suffix = pattern.slice(idx + '{stem}'.length)
			if (suffix && word.endsWith(suffix)) {
				const candidate = word.slice(0, word.length - suffix.length)
				if (candidate.length < best.length && candidate.length > 0) best = candidate
			}
		}
		return best
	})

	// Live preview: apply rules to the current stem (or placeholder fallback)
	const previewStem = $derived(stem.trim() || stemPlaceholder)
	const livePreview = $derived.by(() => {
		const out: Array<{ cell: string, form: string }> = []
		for (const key of cellKeys) {
			const override = overrides[key]?.trim()
			const pattern = selectedClassRules[key]
			if (override) out.push({ cell: key, form: override })
			else if (pattern) out.push({ cell: key, form: applyStem(pattern, previewStem) })
		}
		return out
	})

	// What the rule alone would generate for an override row
	function ruleWouldBe(key: string): string {
		const pattern = selectedClassRules[key]
		if (!pattern) return ''
		return applyStem(pattern, previewStem)
	}

	const inputClass = 'px-2 py-1 border border-border-strong text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent'
</script>

{#if editing}
	<div class="mt-4 p-4 bg-raised border border-border space-y-3">
		<div class="flex items-center justify-between">
			<h4 class="text-xs font-medium uppercase tracking-wide text-dim">Set up inflection</h4>
			<div class="flex gap-2">
				{#if inflection.hasInflection}
					<button onclick={removeInflection} class="text-xs text-error hover:underline">Remove</button>
				{/if}
				<button onclick={() => editing = false} class="text-xs text-faint hover:text-secondary">Cancel</button>
			</div>
		</div>

		<WorkedInflectionExample compact />

		{#if error}
			<div class="p-2 bg-error-bg border border-error-border text-error text-xs">{error}</div>
		{/if}

		<div class="flex gap-3 flex-wrap">
			<!-- Paradigm class -->
			<div class="flex-1 min-w-[200px]">
				<label class="block text-xs font-medium text-secondary mb-1">Paradigm class</label>
				{#if filteredClasses.length > 0}
					<Select
						type="single"
						numeric
						bind:value={selectedClassId}
						placeholder="Manual (no class)"
						items={filteredClasses.map(cls => ({ value: String(cls.id), label: cls.name }))}
						containerClass="w-full"
					/>
					<p class="text-xs text-faint mt-1">Picks the rule set. Forms below auto-generate from the class's rules + the stem.</p>
				{:else}
					<div class="p-2 bg-warning-bg border border-warning-border text-xs text-body">
						{#if availableClasses.length > 0}
							No paradigm classes for <strong>{partOfSpeech || 'this part of speech'}</strong>.
							Classes exist for other parts of speech — see
							<a href="/Wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">Inflections</a>.
						{:else if inflection.dimensions.length > 0}
							No paradigm classes defined yet.
							<a href="/Wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">Create a class</a>,
							then come back to assign it.
						{:else}
							No inflection system set up for this language.
							<a href="/Wordbook/contribute/language/{languageSlug}?tab=inflections" class="text-link hover:underline">Add dimensions</a>
							(e.g. Case, Number) and paradigm classes first.
						{/if}
					</div>
				{/if}
			</div>

			<!-- Stem -->
			<div class="flex-1 min-w-[150px]">
				<label class="block text-xs font-medium text-secondary mb-1">Stem</label>
				<Input bind:value={stem} containerClass="w-full" placeholder={`e.g. ${stemPlaceholder}`} />
				<p class="text-xs text-faint mt-1">The unchanging part the rules attach to — usually the word minus its ending.</p>
			</div>
		</div>

		{#if selectedClassId !== null && livePreview.length > 0}
			<div class="p-2 bg-page border border-border-subtle">
				<div class="text-xs text-dim mb-1">Will generate:</div>
				<div class="text-xs font-mono text-body flex flex-wrap gap-x-3 gap-y-0.5">
					{#each livePreview as cell (cell.cell)}
						<span><span class="text-faint">{cellKeyLabel(cell.cell)}:</span> {cell.form}</span>
					{/each}
				</div>
			</div>
		{:else if selectedClassId !== null && loadingRules}
			<div class="text-xs text-faint">Loading class rules…</div>
		{/if}

		<!-- Override grid -->
		{#if cellKeys.length > 0}
			<div>
				<label class="block text-xs font-medium text-secondary mb-1">
					Irregular forms (overrides)
				</label>
				<p class="text-xs text-faint mb-2">Leave blank to use the class rule. Fill a cell only when this word breaks the pattern.</p>
				<div class="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
					{#each cellKeys as key (key)}
						{@const generated = ruleWouldBe(key)}
						{@const hasOverride = (overrides[key] ?? '').trim().length > 0}
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
								class="flex-1 {inputClass} text-xs {hasOverride ? 'border-accent bg-accent-subtle' : ''}"
							/>
							{#if hasOverride && generated}
								<span class="text-xs text-faint whitespace-nowrap" title="Rule would generate this">would be: {generated}</span>
							{/if}
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
			{saving ? 'Saving…' : 'Save inflection'}
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
