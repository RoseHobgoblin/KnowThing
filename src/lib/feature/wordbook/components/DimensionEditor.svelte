<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import WorkedInflectionExample from './WorkedInflectionExample.svelte'
	import { PARTS_OF_SPEECH } from './constants.js'
	import { generateCellKeys, cellKeyLabel } from '$lib/feature/wordbook/cell-keys.js'
	import { applyStem } from '$lib/feature/wordbook/inflection-pattern.js'
	import { DIMENSION_PRESETS, CLASS_PRESETS, type DimensionPreset, type ClassPreset } from './dimension-presets.js'
	import { createMutation, useQueryClient } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

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
		if (order === 0) return m.wbc_axis_rows()
		if (order === 1) return m.wbc_axis_columns()
		return m.wbc_axis_subtable()
	}

	const SORT_OPTIONS = [
		{ value: '0', label: m.wbc_axis_rows() },
		{ value: '1', label: m.wbc_axis_columns() },
		{ value: '2', label: m.wbc_axis_subtables_3d() },
	]

	let confirmDialog: ReturnType<typeof ConfirmDialog>
	const queryClient = useQueryClient()
	const dimensionMutation = createMutation(() => ({
		mutationFn: ({ method, id, body }: { method: 'POST' | 'DELETE', id?: number, body?: unknown }) =>
			api(method, `/api/languages/${languageSlug}/inflections/dimensions${id ? `/${id}` : ''}`, body),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['languages', languageSlug, 'inflection-classes'] }),
	}))
	const classMutation = createMutation(() => ({
		mutationFn: ({ method, id, body }: { method: 'POST' | 'PUT' | 'DELETE', id?: number, body?: unknown }) =>
			api(method, `/api/languages/${languageSlug}/inflections/classes${id ? `/${id}` : ''}`, body),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['languages', languageSlug, 'inflection-classes'] }),
	}))

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
	const addingDim = $derived(dimensionMutation.isPending)

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
		return labels ? m.wbc_axis_already_taken({ labels, pos: newDimPos }) : ''
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
			return m.wbc_table_shape_with_cells({ axis: newDimAxis.toLowerCase(), values: vals.join(' · '), count: total })
		}
		return m.wbc_table_shape({ axis: newDimAxis.toLowerCase(), values: vals.join(' · ') })
	})

	async function addDimension(event: SubmitEvent) {
		event.preventDefault()
		if (!newDimName.trim() || !newDimValues.trim()) return
		const sortOrder = showDisplayAs ? Number(newDimSort) || 0 : 0
		try {
			await dimensionMutation.mutateAsync({ method: 'POST', body: {
				partOfSpeech: newDimPos,
				name: newDimName.trim(),
				values: newDimValues.split(',').map(v => v.trim()).filter(Boolean),
				sortOrder,
			} })
			pushSuccess(m.wbc_dimension_created())
			newDimName = ''
			newDimValues = ''
			showAddDim = false
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_create_dimension())
		}
	}

	async function quickAddPreset(preset: DimensionPreset) {
		// One-click empty-state CTA — POSTs without opening the form.
		try {
			await dimensionMutation.mutateAsync({ method: 'POST', body: {
				partOfSpeech: preset.pos,
				name: preset.name,
				values: preset.values,
				sortOrder: preset.sortOrder,
			} })
			pushSuccess(m.wbc_dimension_added_for({ name: preset.name, pos: preset.pos }))
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_create_dimension())
		}
	}

	async function deleteDimension(dimId: number) {
		const ok = await confirmDialog.confirm(m.wbc_remove_dimension(), m.wbc_remove_dimension_confirm(), m.common_remove(), m.common_cancel())
		if (!ok) return
		try {
			await dimensionMutation.mutateAsync({ method: 'DELETE', id: dimId })
			pushSuccess(m.wbc_dimension_removed())
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_remove_dimension())
		}
	}

	// ── Add class form ─────────────────────────────────────────────────
	let showAddClass = $state(false)
	let newClassPos = $state('noun')
	let newClassName = $state('')
	let newClassDesc = $state('')
	const addingClass = $derived(classMutation.isPending)

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
		try {
			await classMutation.mutateAsync({ method: 'POST', body: {
				partOfSpeech: newClassPos,
				name: newClassName.trim(),
				description: newClassDesc.trim() || undefined,
			} })
			pushSuccess(m.wbc_class_created())
			newClassName = ''
			newClassDesc = ''
			showAddClass = false
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_create_class())
		}
	}

	async function deleteClass(classId: number) {
		const ok = await confirmDialog.confirm(m.wbc_delete_class(), m.wbc_delete_class_confirm(), m.common_delete(), m.common_cancel())
		if (!ok) return
		try {
			await classMutation.mutateAsync({ method: 'DELETE', id: classId })
			pushSuccess(m.wbc_class_deleted())
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_delete_class())
		}
	}

	// ── Rules editor ───────────────────────────────────────────────────
	let editingClassId = $state<number | null>(null)
	let editingClassName = $state<string>('')
	let editingRules = $state<Array<{ cellKey: string, pattern: string }>>([])
	let loadingRules = $state(false)
	const savingRules = $derived(classMutation.isPending)
	let previewStem = $state('cat')

	async function openRulesEditor(cls: { id: number, name: string, partOfSpeech: string }) {
		if (editingClassId === cls.id) {
			editingClassId = null
			return
		}
		loadingRules = true
		editingClassId = cls.id
		editingClassName = cls.name

		const data = await queryClient.fetchQuery({
			queryKey: ['languages', languageSlug, 'inflection-classes', cls.id],
			queryFn: () => api<{ rules?: Array<{ cellKey: string, pattern: string }> }>(
				'GET', `/api/languages/${languageSlug}/inflections/classes/${cls.id}`,
			),
		})
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
		const nonEmpty = editingRules.filter(r => r.pattern.trim())
		try {
			await classMutation.mutateAsync({ method: 'PUT', id: editingClassId, body: { rules: nonEmpty } })
			pushSuccess(m.wbc_rules_saved())
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.wbc_failed_save_rules())
		}
		editingClassId = null
		await invalidateAll()
	}

	const previewRibbon = $derived.by(() => {
		const first = editingRules.find(r => r.pattern.trim())
		if (!first) return ''
		const out = applyStem(first.pattern, previewStem)
		return m.wbc_preview_ribbon({ name: editingClassName, cell: cellKeyLabel(first.cellKey), pattern: first.pattern, stem: previewStem, result: out })
	})
</script>

<div class="space-y-4">
	<WorkedInflectionExample />

	<!-- ── Section 1: Dimensions ───────────────────────────────────── -->
	<section class="bg-surface p-4 space-y-3">
		<div class="flex items-start justify-between gap-2">
			<div>
				<h3 class="text-sm font-semibold text-body">{m.wbc_dimensions_heading()}</h3>
				<p class="text-xs text-secondary mt-0.5">{m.wbc_dimensions_intro()}</p>
			</div>
			<button onclick={() => showAddDim = !showAddDim} class="text-xs text-link whitespace-nowrap hover:text-link-hover hover:underline">+ {m.wbc_dimension()}</button>
		</div>

		{#if showAddDim}
			<form onsubmit={addDimension} class="p-3 bg-page border-l-2 border-l-accent border-y border-r border-border space-y-2">
				<div class="text-xs font-medium text-dim mb-1">{m.wbc_new_dimension()}</div>

				<!-- Click-to-fill chips -->
				<div class="flex flex-wrap items-center gap-1.5 text-xs">
					<span class="text-secondary">{m.wbc_try_one_click_fill()}</span>
					{#each DIMENSION_PRESETS as preset (preset.label)}
						<button
							type="button"
							onclick={() => applyDimensionPreset(preset)}
							class="px-2 py-0.5 bg-surface text-secondary transition-colors hover:bg-accent-subtle hover:text-accent"
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
					<Input bind:value={newDimName} placeholder={m.wbc_dimension_name_placeholder()} required containerClass="flex-1 min-w-[160px]" />
					{#if showDisplayAs}
						<div class="flex items-center gap-2">
							<span class="text-xs text-dim whitespace-nowrap">{m.wbc_display_as()}</span>
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

				<Input bind:value={newDimValues} placeholder={m.wbc_values_comma_separated()} required containerClass="w-full" />

				{#if newDimShapeLine}
					<p class="text-xs text-secondary">
						<span class="text-secondary">{m.wbc_your_table_will_have()}</span> {newDimShapeLine}
					</p>
				{:else}
					<p class="text-xs text-secondary">{m.wbc_type_at_least_one_value_prefix()} <code class="bg-surface-dim px-1 rounded-sm">singular, plural</code>.</p>
				{/if}

				<div class="flex gap-2">
					<button type="submit" disabled={addingDim} class="px-3 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">{m.common_add()}</button>
					<button type="button" onclick={() => showAddDim = false} class="text-xs text-secondary">{m.common_cancel()}</button>
				</div>
			</form>
		{/if}

		{#if dimensions.length === 0 && !showAddDim}
			<div class="space-y-2">
				<p class="text-xs text-secondary">{m.wbc_no_dimensions_pick_starter()}</p>
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
				<h3 class="text-sm font-semibold text-body">{m.wbc_classes_heading()}</h3>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
				<p class="text-xs text-secondary mt-0.5">{@html m.wbc_classes_intro()}</p>
			</div>
			<button onclick={() => showAddClass = !showAddClass} class="text-xs text-link whitespace-nowrap hover:text-link-hover hover:underline">+ {m.wbc_class()}</button>
		</div>

		{#if showAddClass}
			<form onsubmit={addClass} class="p-3 bg-page border-l-2 border-l-accent-secondary border-y border-r border-border space-y-2">
				<div class="text-xs font-medium text-dim mb-1">{m.wbc_new_class()}</div>

				<div class="flex flex-wrap items-center gap-1.5 text-xs">
					<span class="text-secondary">{m.wbc_try_one_click_fill()}</span>
					{#each CLASS_PRESETS as preset (preset.label)}
						<button
							type="button"
							onclick={() => applyClassPreset(preset)}
							class="px-2 py-0.5 bg-surface text-secondary transition-colors hover:bg-accent-subtle hover:text-accent"
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
					<Input bind:value={newClassName} placeholder={m.wbc_class_name_placeholder()} required containerClass="flex-1 min-w-[180px]" />
				</div>
				<Input bind:value={newClassDesc} placeholder={m.wbc_description_optional()} containerClass="w-full" />

				{#if newClassCellsHint}
					<p class="text-xs text-secondary">
						<span class="text-secondary">{m.wbc_this_class_will_have()}</span> {m.wbc_cells_count({ count: newClassCellsHint.count })}:
						<span class="font-mono text-secondary">{newClassCellsHint.labels.join(' · ')}{newClassCellsHint.truncated ? ' …' : ''}</span>
						<span class="text-secondary">{m.wbc_cells_from({ dims: newClassCellsHint.dimNames })}</span>
					</p>
				{:else}
					<p class="text-xs text-secondary">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
						{@html m.wbc_no_dimensions_for_pos({ pos: newClassPos })}
						<button
							type="button"
							onclick={() => {
								showAddClass = false
								showAddDim = true
								newDimPos = newClassPos
							}}
							class="text-link hover:underline"
						>{m.wbc_add_a_dimension()}</button>.
					</p>
				{/if}

				<div class="flex gap-2">
					<button type="submit" disabled={addingClass} class="px-3 py-1 bg-accent text-surface text-xs hover:bg-accent-hover disabled:opacity-50">{m.common_add()}</button>
					<button type="button" onclick={() => showAddClass = false} class="text-xs text-secondary">{m.common_cancel()}</button>
				</div>
			</form>
		{/if}

		{#if classes.length === 0 && !showAddClass}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
			<p class="text-xs text-secondary">{@html m.wbc_no_classes_yet()}</p>
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
											<span class="text-xs px-1.5 py-0.5 border border-warning-border bg-warning-bg text-body">{m.wbc_badge_no_dimensions()}</span>
										{:else if ruleN === 0}
											<span class="text-xs px-1.5 py-0.5 border border-warning-border bg-warning-bg text-body">{m.wbc_badge_no_rules()}</span>
										{:else}
											<span class="text-xs px-1.5 py-0.5 bg-page text-dim">{m.wbc_badge_rules_count({ count: ruleN, total: totalCells })}</span>
										{/if}
										{#if cls.description}
											<span class="text-secondary text-xs">— {cls.description}</span>
										{/if}
										<button onclick={() => deleteClass(cls.id)} class="text-error text-xs opacity-0 transition-opacity hover:text-error-hover group-hover:opacity-100">×</button>
									</div>

									{#if editingClassId === cls.id}
										<div class="mt-2 p-3 bg-page space-y-3">
											{#if loadingRules}
												<p class="text-xs text-secondary">{m.wbc_loading_rules()}</p>
											{:else if editingRules.length === 0}
												<p class="text-xs text-secondary">
													<!-- eslint-disable-next-line svelte/no-at-html-tags -- localized static markup, not user input -->
													{@html m.wbc_no_dimensions_defined_for_pos({ pos })}
												</p>
												<div class="flex gap-2">
													<button onclick={() => editingClassId = null} class="text-xs text-secondary hover:text-dim">{m.common_cancel()}</button>
												</div>
											{:else}
												<div>
													<h4 class="text-xs font-semibold text-body mb-2">{m.wbc_rules_for_heading()} <em>{cls.name}</em></h4>
													<p class="text-xs text-secondary">
														{m.wbc_rules_pattern_help_before()} <code class="bg-surface-dim px-1 rounded-sm">{'{stem}'}</code> {m.wbc_rules_pattern_help_after()}
													</p>
												</div>

												{#if previewRibbon}
													<div class="text-xs bg-accent-subtle border border-accent-border px-2 py-1 text-body">{previewRibbon}</div>
												{/if}

												<div class="flex items-center gap-2">
													<span class="text-xs text-dim">{m.wbc_try_a_stem()}</span>
													<Input bind:value={previewStem} containerClass="w-32" class="font-mono" />
												</div>

												<div class="overflow-x-auto">
													<table class="w-full text-sm">
														<thead>
															<tr class="border-b border-border">
																<th class="text-left text-xs text-dim font-medium py-1 pr-3">{m.wbc_col_cell()}</th>
																<th class="text-left text-xs text-dim font-medium py-1 pr-3">{m.wbc_col_pattern()}</th>
																<th class="text-left text-xs text-dim font-medium py-1">{m.common_preview()}</th>
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
														{savingRules ? m.common_saving() : m.wbc_save_rules()}
													</button>
													<button onclick={() => editingClassId = null} class="text-xs text-secondary hover:text-dim">{m.common_cancel()}</button>
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
