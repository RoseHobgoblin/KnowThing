<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import { PARTS_OF_SPEECH } from './constants.js'
	import { generateCellKeys, cellKeyLabel } from '$lib/wordbook/cell-keys.js'

	let { languageSlug, dimensions = [], classes = [] }: {
		languageSlug: string
		dimensions: Array<{ id: number, languageId: number, partOfSpeech: string, name: string, dimValues: string[], sortOrder: number }>
		classes: Array<{ id: number, languageId: number, partOfSpeech: string, name: string, description: string | null }>
	} = $props()

	// Group dimensions by POS
	const grouped = $derived.by(() => {
		const map = new Map<string, typeof dimensions>()
		for (const d of dimensions) {
			if (!map.has(d.partOfSpeech)) map.set(d.partOfSpeech, [])
			map.get(d.partOfSpeech)!.push(d)
		}
		return map
	})

	const classesGrouped = $derived.by(() => {
		const map = new Map<string, typeof classes>()
		for (const c of classes) {
			if (!map.has(c.partOfSpeech)) map.set(c.partOfSpeech, [])
			map.get(c.partOfSpeech)!.push(c)
		}
		return map
	})

	// Generate cell keys from dimensions for a given POS
	function getCellKeysForPos(pos: string): string[] {
		const dims = grouped.get(pos)
		if (!dims || dims.length === 0) return []
		return generateCellKeys(dims.map(d => ({ values: d.dimValues, sortOrder: d.sortOrder })))
	}

	let confirmDialog: ReturnType<typeof ConfirmDialog>

	let showHelp = $state(false)

	// Add dimension form
	let showAddDim = $state(false)
	let newDimPos = $state('noun')
	let newDimName = $state('')
	let newDimValues = $state('')
	let newDimSort = $state(0)
	let addingDim = $state(false)

	async function addDimension(e: SubmitEvent) {
		e.preventDefault()
		if (!newDimName.trim() || !newDimValues.trim()) return
		addingDim = true
		const res = await fetch(`/api/languages/${languageSlug}/inflections/dimensions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: newDimPos,
				name: newDimName.trim(),
				values: newDimValues.split(',').map(v => v.trim()).filter(Boolean),
				sortOrder: newDimSort,
			}),
		})
		if (res.ok) {
			pushSuccess('Dimension created')
			newDimName = ''; newDimValues = ''; showAddDim = false
			invalidateAll()
		} else {
			pushError('Failed to create dimension')
		}
		addingDim = false
	}

	async function deleteDimension(dimId: number) {
		const ok = await confirmDialog.confirm('Remove dimension', 'Remove this dimension? This will affect all paradigm rules using it.', 'Remove', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/languages/${languageSlug}/inflections/dimensions/${dimId}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess('Dimension removed')
			invalidateAll()
		} else {
			pushError('Failed to remove dimension')
		}
	}

	// Add class form
	let showAddClass = $state(false)
	let newClassPos = $state('noun')
	let newClassName = $state('')
	let newClassDesc = $state('')
	let addingClass = $state(false)

	async function addClass(e: SubmitEvent) {
		e.preventDefault()
		if (!newClassName.trim()) return
		addingClass = true
		const res = await fetch(`/api/languages/${languageSlug}/inflections/classes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				partOfSpeech: newClassPos,
				name: newClassName.trim(),
				description: newClassDesc.trim() || undefined,
			}),
		})
		if (res.ok) {
			pushSuccess('Paradigm class created')
			newClassName = ''; newClassDesc = ''; showAddClass = false
			invalidateAll()
		} else {
			pushError('Failed to create paradigm class')
		}
		addingClass = false
	}

	async function deleteClass(classId: number) {
		const ok = await confirmDialog.confirm('Delete paradigm class', 'Delete this paradigm class and all its rules?', 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/languages/${languageSlug}/inflections/classes/${classId}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess('Paradigm class deleted')
			invalidateAll()
		} else {
			pushError('Failed to delete paradigm class')
		}
	}

	// Rules editor state
	let editingClassId = $state<number | null>(null)
	let editingRules = $state<Array<{ cellKey: string, pattern: string }>>([])
	let loadingRules = $state(false)
	let savingRules = $state(false)
	let previewStem = $state('tsida')

	async function openRulesEditor(cls: { id: number, partOfSpeech: string }) {
		if (editingClassId === cls.id) {
			editingClassId = null
			return
		}
		loadingRules = true
		editingClassId = cls.id

		// Fetch existing rules
		const res = await fetch(`/api/languages/${languageSlug}/inflections/classes/${cls.id}`)
		const data = await res.json()
		const existingRules: Record<string, string> = {}
		for (const r of data.rules || []) {
			existingRules[r.cellKey] = r.pattern
		}

		// Generate all cell keys for this POS and pre-fill
		const cellKeys = getCellKeysForPos(cls.partOfSpeech)
		editingRules = cellKeys.map(key => ({
			cellKey: key,
			pattern: existingRules[key] || '',
		}))

		loadingRules = false
	}

	async function saveRules() {
		if (editingClassId === null) return
		savingRules = true
		const nonEmpty = editingRules.filter(r => r.pattern.trim())
		const res = await fetch(`/api/languages/${languageSlug}/inflections/classes/${editingClassId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ rules: nonEmpty }),
		})
		if (res.ok) {
			pushSuccess('Rules saved')
		} else {
			pushError('Failed to save rules')
		}
		savingRules = false
		editingClassId = null
		invalidateAll()
	}

	function previewForm(pattern: string): string {
		if (!pattern.trim()) return '—'
		if (!pattern.includes('{stem}')) return pattern
		return pattern.replaceAll('{stem}', previewStem)
	}

	const inputClass = 'px-3 py-1.5 border border-border-strong text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent'
</script>

<div class="bg-surface border border-border p-4">
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			<h3 class="text-sm font-semibold text-body">Inflection System</h3>
			<button onclick={() => showHelp = !showHelp} class="text-[10px] text-faint hover:text-link border border-border-subtle rounded px-1.5 py-0.5">{showHelp ? 'Hide help' : '?'}</button>
		</div>
		<div class="flex gap-2">
			<button onclick={() => showAddDim = !showAddDim} class="text-xs text-link hover:text-link-hover hover:underline">+ Dimension</button>
			<button onclick={() => showAddClass = !showAddClass} class="text-xs text-link hover:text-link-hover hover:underline">+ Class</button>
		</div>
	</div>

	{#if showHelp}
		<div class="mb-4 p-3 bg-page border border-border-subtle text-xs text-secondary space-y-2">
			<p><strong>Dimensions</strong> are axes of variation — like <em>Case</em> (nominative, accusative...) or <em>Number</em> (singular, plural). Each dimension applies to a part of speech.</p>
			<p><strong>Sort order</strong> controls table layout: <code class="bg-surface-dim px-1 rounded">0</code> = table rows, <code class="bg-surface-dim px-1 rounded">1</code> = columns, <code class="bg-surface-dim px-1 rounded">2+</code> = grouped sections.</p>
			<p><strong>Paradigm classes</strong> group words that inflect the same way (e.g. "Class I regular nouns").</p>
			<p><strong>Rules</strong> define the pattern for each cell. Use <code class="bg-surface-dim px-1 rounded">{'{'+'stem}'}</code> as a placeholder for the word's stem. Example: <code class="bg-surface-dim px-1 rounded">{'{'+'stem}n'}</code> means "add -n to the stem".</p>
			<p class="text-faint"><strong>Workflow:</strong> Add dimensions → Create a class → Click the class name to add rules → Go to a word page and assign the class + set the stem.</p>
		</div>
	{/if}

	<!-- Add dimension form -->
	{#if showAddDim}
		<form onsubmit={addDimension} class="p-3 bg-page border border-border mb-3 space-y-2">
			<div class="text-xs font-medium text-dim mb-1">New dimension</div>
			<div class="flex gap-2 flex-wrap">
				<Select
					type="single"
					bind:value={newDimPos}
					items={PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos }))}
					size="sm"
				/>
				<Input bind:value={newDimName} placeholder="Name (e.g. Case)" required containerClass="flex-1 min-w-[120px]" />
				<Input type="number" bind:value={newDimSort} containerClass="w-16" title="Sort order (0=rows, 1=columns)" />
			</div>
			<Input bind:value={newDimValues} placeholder="Values, comma-separated (e.g. nominative, accusative, genitive, dative)" required containerClass="w-full" />
			<div class="flex gap-2">
				<button type="submit" disabled={addingDim} class="
					px-3 py-1 bg-accent text-surface text-xs
					hover:bg-accent-hover
					disabled:opacity-50
				">Add</button>
				<button type="button" onclick={() => showAddDim = false} class="text-xs text-faint">Cancel</button>
			</div>
		</form>
	{/if}

	<!-- Add class form -->
	{#if showAddClass}
		<form onsubmit={addClass} class="p-3 bg-page border border-border mb-3 space-y-2">
			<div class="text-xs font-medium text-dim mb-1">New paradigm class</div>
			<div class="flex gap-2 flex-wrap">
				<Select
					type="single"
					bind:value={newClassPos}
					items={PARTS_OF_SPEECH.map(pos => ({ value: pos, label: pos }))}
					size="sm"
				/>
				<Input bind:value={newClassName} placeholder="Name (e.g. Class 1 Regular)" required containerClass="flex-1 min-w-[150px]" />
			</div>
			<Input bind:value={newClassDesc} placeholder="Description (optional)" containerClass="w-full" />
			<div class="flex gap-2">
				<button type="submit" disabled={addingClass} class="
					px-3 py-1 bg-accent text-surface text-xs
					hover:bg-accent-hover
					disabled:opacity-50
				">Add</button>
				<button type="button" onclick={() => showAddClass = false} class="text-xs text-faint">Cancel</button>
			</div>
		</form>
	{/if}

	<!-- Existing dimensions grouped by POS -->
	{#if dimensions.length > 0}
		<div class="space-y-4">
			{#each [...grouped.entries()] as [pos, dims]}
				<div>
					<div class="text-xs font-semibold text-dim uppercase tracking-wide mb-1">{pos}</div>
					<div class="space-y-1 mb-2">
						{#each dims as dim}
							<div class="flex items-center gap-2 text-sm group">
								<span class="font-medium text-secondary">{dim.name}</span>
								<span class="text-faint text-xs">[{dim.dimValues.join(', ')}]</span>
								<span class="text-faint text-[10px]">axis {dim.sortOrder}</span>
								<button onclick={() => deleteDimension(dim.id)} class="
									text-error text-xs opacity-0 transition-opacity
									hover:text-error-hover
									group-hover:opacity-100
								">×</button>
							</div>
						{/each}
					</div>

					<!-- Classes for this POS -->
					{#if classesGrouped.has(pos)}
						<div class="ml-2 space-y-1">
							{#each classesGrouped.get(pos) || [] as cls}
								<div class="group">
									<div class="flex items-center gap-2 text-sm">
										<button
											onclick={() => openRulesEditor(cls)}
											class="text-link font-medium cursor-pointer text-sm hover:underline"
										>
											{cls.name}
										</button>
										{#if cls.description}
											<span class="text-faint text-xs">— {cls.description}</span>
										{/if}
										<button onclick={() => deleteClass(cls.id)} class="
											text-error text-xs opacity-0 transition-opacity
											hover:text-error-hover
											group-hover:opacity-100
										">×</button>
									</div>

									<!-- Inline rules editor -->
									{#if editingClassId === cls.id}
										<div class="mt-2 p-3 bg-page border border-border">
											{#if loadingRules}
												<p class="text-xs text-faint">Loading rules...</p>
											{:else}
												<div class="flex items-center gap-2 mb-3">
													<span class="text-xs text-dim">Preview stem:</span>
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
															{#each editingRules as rule, index}
																<tr class="border-b border-border-subtle">
																	<td class="py-1.5 pr-3 text-xs text-secondary font-mono whitespace-nowrap">{cellKeyLabel(rule.cellKey)}</td>
																	<td class="py-1.5 pr-3">
																		<Input
																			bind:value={editingRules[index].pattern}
																			placeholder={'{stem}n'}
																			containerClass="w-full"
																			class="font-mono"
																		/>
																	</td>
																	<td class="py-1.5 text-xs font-mono text-faint">{previewForm(rule.pattern)}</td>
																</tr>
															{/each}
														</tbody>
													</table>
												</div>

												{#if editingRules.length === 0}
													<p class="text-xs text-faint py-2">No dimensions defined for {pos}. Add dimensions first.</p>
												{/if}

												<div class="flex gap-2 mt-3">
													<button
														onclick={saveRules}
														disabled={savingRules}
														class="
															px-3 py-1 bg-accent text-surface text-xs
															hover:bg-accent-hover
															disabled:opacity-50
														"
													>
														{savingRules ? 'Saving...' : 'Save rules'}
													</button>
													<button onclick={() => editingClassId = null} class="text-xs text-faint hover:text-dim">Cancel</button>
												</div>

												<p class="text-[10px] text-faint mt-2">
													Use <code class="bg-surface-dim px-1">{'{'+'stem}'}</code> as placeholder. Example: <code class="bg-surface-dim px-1">{'{'+'stem}n'}</code> produces "{previewStem}n"
												</p>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-xs text-faint">No inflection dimensions defined yet. Add dimensions to enable declension/conjugation tables.</p>
	{/if}
</div>

<ConfirmDialog bind:this={confirmDialog} />
