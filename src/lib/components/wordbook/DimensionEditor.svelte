<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import WorkedInflectionExample from './WorkedInflectionExample.svelte'
	import { PARTS_OF_SPEECH } from './constants.js'
	import { generateCellKeys, cellKeyLabel } from '$lib/wordbook/cell-keys.js'
	import { applyStem } from '$lib/wordbook/inflection-pattern.js'
	import { DIMENSION_PRESETS, CLASS_PRESETS, type DimensionPreset, type ClassPreset } from './dimension-presets.js'

	let { languageSlug, dimensions = [], classes = [], ruleCounts = {} }: {
		languageSlug: string
		dimensions: Array<{ id: number, languageId: number, partOfSpeech: string, name: string, dimValues: string[], sortOrder: number }>
		classes: Array<{ id: number, languageId: number, partOfSpeech: string, name: string, description: string | null }>
		ruleCounts?: Record<number, number>
	} = $props()

	function dimsByPos(pos: string) {
		return dimensions.filter(d => d.partOfSpeech === pos)
	}

	function cellKeysForPos(pos: string): string[] {
		const dims = dimsByPos(pos)
		if (dims.length === 0) return []
		return generateCellKeys(dims.map(d => ({ values: d.dimValues, sortOrder: d.sortOrder })))
	}

	function sortLabel(order: number): string {
		if (order === 0) return 'Rows'
		if (order === 1) return 'Columns'
		return 'Sub-table'
	}

	const SORT_OPTIONS = [
		{ value: '0', label: 'Rows' },
		{ value: '1', label: 'Columns' },
		{ value: '2', label: 'Sub-tables (3D+)' },
	]

	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const allPos = $derived.by(() => {
		const seen: Record<string, true> = {}
		const order: string[] = []
		const visit = (pos: string) => {
			if (seen[pos]) return
			seen[pos] = true
			order.push(pos)
		}
		for (const d of dimensions) visit(d.partOfSpeech)
		for (const c of classes) visit(c.partOfSpeech)
		return order
	})

	// ── Add dimension form ─────────────────────────────────────────────
	let showAddDim = $state(false)
	let newDimPos = $state('noun')
	let newDimName = $state('')
	let newDimValues = $state('')
	let newDimSort = $state<string>('0')
	let addingDim = $state(false)

	function applyDimensionPreset(preset: DimensionPreset) {
		newDimPos = preset.pos
		newDimName = preset.name
		newDimValues = preset.values.join(', ')
		// If a dimension already takes that axis on this POS, auto-pick the next free one.
		const taken = new Set(dimsByPos(preset.pos).map(d => d.sortOrder))
		const free = [0, 1, 2].find(n => !taken.has(n)) ?? preset.sortOrder
		newDimSort = String(free)
	}

	// Hide Display-as picker for the very first dimension on a POS — Rows is the
	// only meaningful choice. Surface it (with a hint) once another dimension exists.
	const existingSorts = $derived(new Set(dimsByPos(newDimPos).map(d => d.sortOrder)))
	const showDisplayAs = $derived(existingSorts.size > 0)
	const displayAsHint = $derived.by(() => {
		const taken = [...existingSorts].toSorted()
		const labels = taken.map(sortLabel).join(', ')
		return labels ? `${labels} already taken on ${newDimPos}` : ''
	})

	$effect(() => {
		// Auto-default Display-as when POS changes: pick the first free axis.
		if (!showAddDim) return
		const taken = new Set(dimsByPos(newDimPos).map(d => d.sortOrder))
		if (!taken.has(Number(newDimSort))) return // current pick is still free
		const free = [0, 1, 2].find(n => !taken.has(n)) ?? 0
		newDimSort = String(free)
	})

	// Live preview of the values the user is typing
	const newDimValuesParsed = $derived(
		newDimValues.split(',').map(v => v.trim()).filter(Boolean),
	)
	const newDimAxis = $derived(sortLabel(Number(newDimSort) || 0))
	const newDimShapeLine = $derived.by(() => {
		const vals = newDimValuesParsed
		if (vals.length === 0) return ''
		const otherDims = dimsByPos(newDimPos).filter(d => d.sortOrder !== Number(newDimSort))
		const otherCells = otherDims.length > 0
			? otherDims.reduce((n, d) => n * d.dimValues.length, 1)
			: 0
		if (otherCells > 0) {
			const total = otherCells * vals.length
			return `${newDimAxis.toLowerCase()}: ${vals.join(' · ')} — table will have ${total} cells`
		}
		return `${newDimAxis.toLowerCase()}: ${vals.join(' · ')}`
	})

	async function addDimension(event: SubmitEvent) {
		event.preventDefault()
		if (!newDimName.trim() || !newDimValues.trim()) return
		addingDim = true
		const sortOrder = showDisplayAs ? Number(newDimSort) || 0 : 0
		const response = await fetch(`/api/languages/${languageSlug}/inflections/dimensions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: newDimPos,
				name: newDimName.trim(),
				values: newDimValues.split(',').map(v => v.trim()).filter(Boolean),
				sortOrder,
			}),
		})
		if (response.ok) {
			pushSuccess('Dimension created')
			newDimName = ''
			newDimValues = ''
			showAddDim = false
			invalidateAll()
		} else {
			pushError('Failed to create dimension')
		}
		addingDim = false
	}

	async function quickAddPreset(preset: DimensionPreset) {
		// One-click empty-state CTA — POSTs without opening the form.
		addingDim = true
		const response = await fetch(`/api/languages/${languageSlug}/inflections/dimensions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: preset.pos,
				name: preset.name,
				values: preset.values,
				sortOrder: preset.sortOrder,
			}),
		})
		if (response.ok) {
			pushSuccess(`Added ${preset.name} for ${preset.pos}`)
			invalidateAll()
		} else {
			pushError('Failed to create dimension')
		}
		addingDim = false
	}

	async function deleteDimension(dimId: number) {
		const ok = await confirmDialog.confirm('Remove dimension', 'Remove this dimension? This will affect all paradigm rules using it.', 'Remove', 'Cancel')
		if (!ok) return
		const response = await fetch(`/api/languages/${languageSlug}/inflections/dimensions/${dimId}`, { method: 'DELETE' })
		if (response.ok) {
			pushSuccess('Dimension removed')
			invalidateAll()
		} else {
			pushError('Failed to remove dimension')
		}
	}

	// ── Add class form ─────────────────────────────────────────────────
	let showAddClass = $state(false)
	let newClassPos = $state('noun')
	let newClassName = $state('')
	let newClassDesc = $state('')
	let addingClass = $state(false)

	function applyClassPreset(preset: ClassPreset) {
		newClassPos = preset.pos
		newClassName = preset.name
		newClassDesc = preset.description
	}

	// Cell skeleton for the currently chosen POS in the class form
	const newClassCells = $derived(cellKeysForPos(newClassPos))
	const newClassCellsHint = $derived.by(() => {
		const cells = newClassCells
		const dims = dimsByPos(newClassPos)
		if (dims.length === 0) return null
		return {
			count: cells.length,
			labels: cells.slice(0, 6).map(cellKeyLabel),
			truncated: cells.length > 6,
			dimNames: dims.map(d => d.name).join(' × '),
		}
	})

	async function addClass(event: SubmitEvent) {
		event.preventDefault()
		if (!newClassName.trim()) return
		addingClass = true
		const response = await fetch(`/api/languages/${languageSlug}/inflections/classes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: newClassPos,
				name: newClassName.trim(),
				description: newClassDesc.trim() || undefined,
			}),
		})
		if (response.ok) {
			pushSuccess('Paradigm class created')
			newClassName = ''
			newClassDesc = ''
			showAddClass = false
			invalidateAll()
		} else {
			pushError('Failed to create paradigm class')
		}
		addingClass = false
	}

	async function deleteClass(classId: number) {
		const ok = await confirmDialog.confirm('Delete paradigm class', 'Delete this paradigm class and all its rules?', 'Delete', 'Cancel')
		if (!ok) return
		const response = await fetch(`/api/languages/${languageSlug}/inflections/classes/${classId}`, { method: 'DELETE' })
		if (response.ok) {
			pushSuccess('Paradigm class deleted')
			invalidateAll()
		} else {
			pushError('Failed to delete paradigm class')
		}
	}

	// ── Rules editor ───────────────────────────────────────────────────
	let editingClassId = $state<number | null>(null)
	let editingClassName = $state<string>('')
	let editingRules = $state<Array<{ cellKey: string, pattern: string }>>([])
	let loadingRules = $state(false)
	let savingRules = $state(false)
	let previewStem = $state('cat')

	async function openRulesEditor(cls: { id: number, name: string, partOfSpeech: string }) {
		if (editingClassId === cls.id) {
			editingClassId = null
			return
		}
		loadingRules = true
		editingClassId = cls.id
		editingClassName = cls.name

		const response = await fetch(`/api/languages/${languageSlug}/inflections/classes/${cls.id}`)
		const data = await response.json()
		const existingRules: Record<string, string> = {}
		for (const r of data.rules || []) {
			existingRules[r.cellKey] = r.pattern
		}

		const keys = cellKeysForPos(cls.partOfSpeech)
		editingRules = keys.map(key => ({
			cellKey: key,
			pattern: existingRules[key] || '',
		}))

		loadingRules = false
	}

	async function saveRules() {
		if (editingClassId === null) return
		savingRules = true
		const nonEmpty = editingRules.filter(r => r.pattern.trim())
		const response = await fetch(`/api/languages/${languageSlug}/inflections/classes/${editingClassId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ rules: nonEmpty }),
		})
		if (response.ok) {
			pushSuccess('Rules saved')
		} else {
			pushError('Failed to save rules')
		}
		savingRules = false
		editingClassId = null
		invalidateAll()
	}

	const previewRibbon = $derived.by(() => {
		const first = editingRules.find(r => r.pattern.trim())
		if (!first) return ''
		const out = applyStem(first.pattern, previewStem)
		return `Class "${editingClassName}": rule for ${cellKeyLabel(first.cellKey)} is ${first.pattern}. With stem ${previewStem} → ${out}.`
	})
</script>

<div class="space-y-4">
	<WorkedInflectionExample />

	<!-- ── Section 1: Dimensions ───────────────────────────────────── -->
	<section class="bg-surface p-4 space-y-3">
		<div class="flex items-start justify-between gap-2">
			<div>
				<h3 class="text-sm font-semibold text-body">1. Dimensions</h3>
				<p class="text-xs text-secondary mt-0.5">What axes does morphology vary on? E.g. nouns vary by Number; verbs vary by Tense and Person.</p>
			</div>
			<button onclick={() => showAddDim = !showAddDim} class="text-xs text-link whitespace-nowrap hover:text-link-hover hover:underline">+ Dimension</button>
		</div>

		{#if showAddDim}
			<form onsubmit={addDimension} class="p-3 bg-page border-l-2 border-l-accent border-y border-r border-border space-y-2">
				<div class="text-xs font-medium text-dim mb-1">New dimension</div>

				<!-- Click-to-fill chips -->
				<div class="flex flex-wrap items-center gap-1.5 text-xs">
					<span class="text-secondary">Try one — click to fill:</span>
					{#each DIMENSION_PRESETS as preset (preset.label)}
						<button
							type="button"
							onclick={() => applyDimensionPreset(preset)}
							class="
								px-2 py-0.5 bg-surface text-secondary transition-colors
								hover:bg-accent-subtle hover:text-accent
							"
						>{preset.label}</button>
					{/each}
				</div>

				<div class="flex gap-2 flex-wrap">
					<Select
						type="single"
						bind:value={newDimPos}
						items={PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos }))}
						size="sm"
					/>
					<Input bind:value={newDimName} placeholder="Name (e.g. Number, Case, Tense)" required containerClass="flex-1 min-w-[160px]" />
					{#if showDisplayAs}
						<div class="flex items-center gap-2">
							<span class="text-xs text-dim whitespace-nowrap">Display as:</span>
							<Select
								type="single"
								bind:value={newDimSort}
								items={SORT_OPTIONS}
								size="sm"
							/>
						</div>
					{/if}
				</div>

				{#if showDisplayAs && displayAsHint}
					<p class="text-xs text-secondary -mt-1">{displayAsHint}</p>
				{/if}

				<Input bind:value={newDimValues} placeholder="Values, comma-separated" required containerClass="w-full" />

				{#if newDimShapeLine}
					<p class="text-xs text-secondary">
						<span class="text-secondary">Your table will have</span> {newDimShapeLine}
					</p>
				{:else}
					<p class="text-xs text-secondary">Type at least one value, e.g. <code class="bg-surface-dim px-1 rounded-sm">singular, plural</code>.</p>
				{/if}

				<div class="flex gap-2">
					<button type="submit" disabled={addingDim} class="px-3 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">Add</button>
					<button type="button" onclick={() => showAddDim = false} class="text-xs text-secondary">Cancel</button>
				</div>
			</form>
		{/if}

		{#if dimensions.length === 0 && !showAddDim}
			<div class="space-y-2">
				<p class="text-xs text-secondary">No dimensions yet. Pick a starter, or open the form for full control:</p>
				<div class="flex flex-wrap gap-1.5">
					{#each DIMENSION_PRESETS.slice(0, 4) as preset (preset.label)}
						<button
							type="button"
							disabled={addingDim}
							onclick={() => quickAddPreset(preset)}
							class="
								px-2 py-1 border border-accent-border bg-accent-subtle text-xs text-accent transition-colors
								hover:bg-accent hover:text-surface
								disabled:opacity-50
							"
						>+ {preset.label}</button>
					{/each}
				</div>
			</div>
		{:else if dimensions.length > 0}
			<div class="space-y-3">
				{#each allPos.filter(p => dimsByPos(p).length > 0) as pos (pos)}
					<div>
						<div class="text-xs font-semibold text-dim uppercase tracking-wide mb-1">{pos}</div>
						<div class="space-y-1">
							{#each dimsByPos(pos) as dim (dim.id)}
								<div class="flex items-center gap-2 text-sm group">
									<span class="font-medium text-secondary">{dim.name}</span>
									<span class="text-secondary text-xs">[{dim.dimValues.join(', ')}]</span>
									<span class="text-xs px-1.5 py-0.5 bg-page text-dim">{sortLabel(dim.sortOrder)}</span>
									<button onclick={() => deleteDimension(dim.id)} class="text-error text-xs opacity-0 transition-opacity hover:text-error-hover group-hover:opacity-100">×</button>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- ── Section 2: Paradigm classes ─────────────────────────────── -->
	<section class="bg-surface p-4 space-y-3">
		<div class="flex items-start justify-between gap-2">
			<div>
				<h3 class="text-sm font-semibold text-body">2. Paradigm classes</h3>
				<p class="text-xs text-secondary mt-0.5">Group words that inflect identically. <em>cat</em> and <em>dog</em> share rules; <em>mouse</em> needs its own class or overrides.</p>
			</div>
			<button onclick={() => showAddClass = !showAddClass} class="text-xs text-link whitespace-nowrap hover:text-link-hover hover:underline">+ Class</button>
		</div>

		{#if showAddClass}
			<form onsubmit={addClass} class="p-3 bg-page border-l-2 border-l-accent-secondary border-y border-r border-border space-y-2">
				<div class="text-xs font-medium text-dim mb-1">New paradigm class</div>

				<div class="flex flex-wrap items-center gap-1.5 text-xs">
					<span class="text-secondary">Try one — click to fill:</span>
					{#each CLASS_PRESETS as preset (preset.label)}
						<button
							type="button"
							onclick={() => applyClassPreset(preset)}
							class="
								px-2 py-0.5 bg-surface text-secondary transition-colors
								hover:bg-accent-subtle hover:text-accent
							"
						>{preset.label}</button>
					{/each}
				</div>

				<div class="flex gap-2 flex-wrap">
					<Select
						type="single"
						bind:value={newClassPos}
						items={PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos }))}
						size="sm"
					/>
					<Input bind:value={newClassName} placeholder="Name (e.g. Regular, Class I, Vowel-stem)" required containerClass="flex-1 min-w-[180px]" />
				</div>
				<Input bind:value={newClassDesc} placeholder="Description (optional)" containerClass="w-full" />

				{#if newClassCellsHint}
					<p class="text-xs text-secondary">
						<span class="text-secondary">This class will have</span> {newClassCellsHint.count} cell{newClassCellsHint.count === 1 ? '' : 's'}:
						<span class="font-mono text-secondary">{newClassCellsHint.labels.join(' · ')}{newClassCellsHint.truncated ? ' …' : ''}</span>
						<span class="text-secondary">(from {newClassCellsHint.dimNames})</span>
					</p>
				{:else}
					<p class="text-xs text-secondary">
						No dimensions for <strong>{newClassPos}</strong> yet. The class will have nothing to inflect until you
						<button
							type="button"
							onclick={() => {
								showAddClass = false
								showAddDim = true
								newDimPos = newClassPos
							}}
							class="text-link hover:underline"
						>add a dimension</button>.
					</p>
				{/if}

				<div class="flex gap-2">
					<button type="submit" disabled={addingClass} class="px-3 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">Add</button>
					<button type="button" onclick={() => showAddClass = false} class="text-xs text-secondary">Cancel</button>
				</div>
			</form>
		{/if}

		{#if classes.length === 0 && !showAddClass}
			<p class="text-xs text-secondary">No classes yet. Add one — e.g. <code class="bg-surface-dim px-1 rounded-sm">Regular</code> for nouns. Then click it to define rules.</p>
		{:else if classes.length > 0}
			<div class="space-y-3">
				{#each allPos.filter(p => classes.some(c => c.partOfSpeech === p)) as pos (pos)}
					{@const totalCells = cellKeysForPos(pos).length}
					<div>
						<div class="text-xs font-semibold text-dim uppercase tracking-wide mb-1">{pos}</div>
						<div class="space-y-1">
							{#each classes.filter(c => c.partOfSpeech === pos) as cls (cls.id)}
								{@const ruleN = ruleCounts[cls.id] ?? 0}
								<div class="group">
									<div class="flex items-center gap-2 text-sm flex-wrap">
										<button
											onclick={() => openRulesEditor(cls)}
											class="text-link font-medium cursor-pointer text-sm hover:underline"
										>
											{cls.name}
										</button>
										{#if totalCells === 0}
											<span class="text-xs px-1.5 py-0.5 border border-warning-border bg-warning-bg text-body">no dimensions yet</span>
										{:else if ruleN === 0}
											<span class="text-xs px-1.5 py-0.5 border border-warning-border bg-warning-bg text-body">no rules — click to add ↓</span>
										{:else}
											<span class="text-xs px-1.5 py-0.5 bg-page text-dim">{ruleN} / {totalCells} rules</span>
										{/if}
										{#if cls.description}
											<span class="text-secondary text-xs">— {cls.description}</span>
										{/if}
										<button onclick={() => deleteClass(cls.id)} class="text-error text-xs opacity-0 transition-opacity hover:text-error-hover group-hover:opacity-100">×</button>
									</div>

									{#if editingClassId === cls.id}
										<div class="mt-2 p-3 bg-page space-y-3">
											{#if loadingRules}
												<p class="text-xs text-secondary">Loading rules…</p>
											{:else if editingRules.length === 0}
												<p class="text-xs text-secondary">
													No dimensions defined for <strong>{pos}</strong> yet.
													Add at least one dimension in section 1 first.
												</p>
												<div class="flex gap-2">
													<button onclick={() => editingClassId = null} class="text-xs text-secondary hover:text-dim">Cancel</button>
												</div>
											{:else}
												<div>
													<h4 class="text-xs font-semibold text-body mb-2">3. Rules for <em>{cls.name}</em></h4>
													<p class="text-xs text-secondary">
														Write a pattern for each cell. <code class="bg-surface-dim px-1 rounded-sm">{'{stem}'}</code> is replaced with the word's stem. Leave a cell blank to omit it.
													</p>
												</div>

												{#if previewRibbon}
													<div class="text-xs bg-accent-subtle border border-accent-border px-2 py-1 text-body">{previewRibbon}</div>
												{/if}

												<div class="flex items-center gap-2">
													<span class="text-xs text-dim">Try a stem:</span>
													<Input bind:value={previewStem} containerClass="w-32" class="font-mono" />
												</div>

												<div class="overflow-x-auto">
													<table class="w-full text-sm">
														<thead>
															<tr class="border-b border-border">
																<th class="text-left text-xs text-dim font-medium py-1 pr-3">Cell</th>
																<th class="text-left text-xs text-dim font-medium py-1 pr-3">Pattern</th>
																<th class="text-left text-xs text-dim font-medium py-1">Preview</th>
															</tr>
														</thead>
														<tbody>
															{#each editingRules as rule, index (rule.cellKey)}
																<tr class="border-b border-border-subtle">
																	<td class="py-1.5 pr-3 text-xs text-secondary font-mono whitespace-nowrap">{cellKeyLabel(rule.cellKey)}</td>
																	<td class="py-1.5 pr-3">
																		<Input
																			bind:value={editingRules[index].pattern}
																			placeholder={'{stem}s'}
																			containerClass="w-full"
																			class="font-mono"
																		/>
																	</td>
																	<td class="py-1.5 text-xs font-mono text-secondary">{rule.pattern.trim() ? applyStem(rule.pattern, previewStem) : '—'}</td>
																</tr>
															{/each}
														</tbody>
													</table>
												</div>

												<div class="flex gap-2">
													<button
														onclick={saveRules}
														disabled={savingRules}
														class="px-3 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50"
													>
														{savingRules ? 'Saving…' : 'Save rules'}
													</button>
													<button onclick={() => editingClassId = null} class="text-xs text-secondary hover:text-dim">Cancel</button>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<ConfirmDialog bind:this={confirmDialog} />
