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

	// Sectioning: dimensions and classes grouped by POS that has either
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

	async function addDimension(event: SubmitEvent) {
		event.preventDefault()
		if (!newDimName.trim() || !newDimValues.trim()) return
		addingDim = true
		const response = await fetch(`/api/languages/${languageSlug}/inflections/dimensions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: newDimPos,
				name: newDimName.trim(),
				values: newDimValues.split(',').map(v => v.trim()).filter(Boolean),
				sortOrder: Number(newDimSort) || 0,
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

	// Preview ribbon — first non-empty rule, applied to previewStem
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
	<section class="bg-surface border border-border p-4 space-y-3">
		<div class="flex items-start justify-between gap-2">
			<div>
				<h3 class="text-sm font-semibold text-body">1. Dimensions</h3>
				<p class="text-xs text-faint mt-0.5">What axes does morphology vary on? E.g. nouns vary by Number; verbs vary by Tense and Person.</p>
			</div>
			<button onclick={() => showAddDim = !showAddDim} class="text-xs text-link whitespace-nowrap hover:text-link-hover hover:underline">+ Dimension</button>
		</div>

		{#if showAddDim}
			<form onsubmit={addDimension} class="p-3 bg-page border border-border space-y-2">
				<div class="text-xs font-medium text-dim mb-1">New dimension</div>
				<div class="flex gap-2 flex-wrap">
					<Select
						type="single"
						bind:value={newDimPos}
						items={PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos }))}
						size="sm"
					/>
					<Input bind:value={newDimName} placeholder="Name (e.g. Number, Case, Tense)" required containerClass="flex-1 min-w-[160px]" />
					<div class="flex items-center gap-2">
						<span class="text-xs text-dim whitespace-nowrap">Display as:</span>
						<Select
							type="single"
							bind:value={newDimSort}
							items={SORT_OPTIONS}
							size="sm"
						/>
					</div>
				</div>
				<Input bind:value={newDimValues} placeholder="Values, comma-separated" required containerClass="w-full" />
				<p class="text-xs text-faint">
					Examples: Number → <code class="bg-surface-dim px-1 rounded-sm">singular, plural</code> · Case → <code class="bg-surface-dim px-1 rounded-sm">nominative, accusative, genitive, dative</code> · Tense → <code class="bg-surface-dim px-1 rounded-sm">present, past, future</code>
				</p>
				<div class="flex gap-2">
					<button type="submit" disabled={addingDim} class="px-3 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">Add</button>
					<button type="button" onclick={() => showAddDim = false} class="text-xs text-faint">Cancel</button>
				</div>
			</form>
		{/if}

		{#if dimensions.length === 0}
			<p class="text-xs text-faint">No dimensions yet. Start with one — e.g. <code class="bg-surface-dim px-1 rounded-sm">Number</code> for nouns.</p>
		{:else}
			<div class="space-y-3">
				{#each allPos.filter(p => dimsByPos(p).length > 0) as pos (pos)}
					<div>
						<div class="text-xs font-semibold text-dim uppercase tracking-wide mb-1">{pos}</div>
						<div class="space-y-1">
							{#each dimsByPos(pos) as dim (dim.id)}
								<div class="flex items-center gap-2 text-sm group">
									<span class="font-medium text-secondary">{dim.name}</span>
									<span class="text-faint text-xs">[{dim.dimValues.join(', ')}]</span>
									<span class="text-xs px-1.5 py-0.5 border border-border-subtle bg-page text-dim">{sortLabel(dim.sortOrder)}</span>
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
	<section class="bg-surface border border-border p-4 space-y-3">
		<div class="flex items-start justify-between gap-2">
			<div>
				<h3 class="text-sm font-semibold text-body">2. Paradigm classes</h3>
				<p class="text-xs text-faint mt-0.5">Group words that inflect identically. <em>cat</em> and <em>dog</em> share rules; <em>mouse</em> needs its own class or overrides.</p>
			</div>
			<button onclick={() => showAddClass = !showAddClass} class="text-xs text-link whitespace-nowrap hover:text-link-hover hover:underline">+ Class</button>
		</div>

		{#if showAddClass}
			<form onsubmit={addClass} class="p-3 bg-page border border-border space-y-2">
				<div class="text-xs font-medium text-dim mb-1">New paradigm class</div>
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
				<div class="flex gap-2">
					<button type="submit" disabled={addingClass} class="px-3 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">Add</button>
					<button type="button" onclick={() => showAddClass = false} class="text-xs text-faint">Cancel</button>
				</div>
			</form>
		{/if}

		{#if classes.length === 0}
			<p class="text-xs text-faint">No classes yet. Add one — e.g. <code class="bg-surface-dim px-1 rounded-sm">Regular</code> for nouns. Then click it to define rules.</p>
		{:else}
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
											<span class="text-xs px-1.5 py-0.5 border border-border-subtle bg-page text-dim">{ruleN} / {totalCells} rules</span>
										{/if}
										{#if cls.description}
											<span class="text-faint text-xs">— {cls.description}</span>
										{/if}
										<button onclick={() => deleteClass(cls.id)} class="text-error text-xs opacity-0 transition-opacity hover:text-error-hover group-hover:opacity-100">×</button>
									</div>

									{#if editingClassId === cls.id}
										<div class="mt-2 p-3 bg-page border border-border space-y-3">
											{#if loadingRules}
												<p class="text-xs text-faint">Loading rules…</p>
											{:else if editingRules.length === 0}
												<p class="text-xs text-faint">
													No dimensions defined for <strong>{pos}</strong> yet.
													Add at least one dimension in section 1 first.
												</p>
												<div class="flex gap-2">
													<button onclick={() => editingClassId = null} class="text-xs text-faint hover:text-dim">Cancel</button>
												</div>
											{:else}
												<div>
													<h4 class="text-xs font-semibold text-body mb-2">3. Rules for <em>{cls.name}</em></h4>
													<p class="text-xs text-faint">
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
																	<td class="py-1.5 text-xs font-mono text-faint">{rule.pattern.trim() ? applyStem(rule.pattern, previewStem) : '—'}</td>
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
													<button onclick={() => editingClassId = null} class="text-xs text-faint hover:text-dim">Cancel</button>
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

	{#if dimensions.length === 0 && classes.length === 0}
		<p class="text-xs text-faint">
			No inflection system yet. Start with <strong>1. Dimensions</strong> above — define what varies (Number, Case, Tense), then make a paradigm class with rules for each cell. The worked example at the top shows the finished pipeline.
		</p>
	{/if}
</div>

<ConfirmDialog bind:this={confirmDialog} />
