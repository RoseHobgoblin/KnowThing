<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import { IPA_SECTIONS, type IpaEntry, type IpaSection } from '$lib/data/ipa-chart.js'
	import { applyModifiers, modifiersFor, IPA_MODIFIERS } from '$lib/data/ipa-modifiers.js'
	import { SvelteSet } from 'svelte/reactivity'
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeftIcon'
	import Plus from 'phosphor-svelte/lib/PlusIcon'

	let {
		open = $bindable(false),
		onpick,
		filter = 'all',
		busy = false,
	}: {
		open?: boolean
		onpick: (entry: IpaEntry) => void
		/** Restrict which sections are shown. 'consonant' hides the vowel/diphthong
		 * sections; 'vowel' shows only vowels + diphthongs. */
		filter?: 'all' | 'consonant' | 'vowel'
		/** Disable symbol buttons while a previous pick is still being saved. */
		busy?: boolean
	} = $props()

	const CONSONANT_SECTIONS = new Set(['pulmonic', 'affricates', 'non-pulmonic', 'co-articulated'])
	const VOWEL_SECTIONS = new Set(['vowels', 'diphthongs'])

	const visibleSections = $derived(
		filter === 'all'
			? IPA_SECTIONS
			: IPA_SECTIONS.filter(s => (filter === 'consonant' ? CONSONANT_SECTIONS : VOWEL_SECTIONS).has(s.id)),
	)

	// Two-phase state. `selected` being non-null = refining phase.
	let selected = $state<IpaEntry | null>(null)
	let selectedModifiers = $state(new SvelteSet<string>())

	const availableModifiers = $derived(selected ? modifiersFor(selected.type) : [])
	const composedSymbol = $derived(selected ? applyModifiers(selected.symbol, selectedModifiers) : '')

	// When the dialog closes, reset refining state so the next open starts clean.
	$effect(() => {
		if (!open) {
			selected = null
			selectedModifiers = new SvelteSet<string>()
		}
	})

	function selectEntry(entry: IpaEntry) {
		selected = entry
		selectedModifiers = new SvelteSet<string>()
	}

	function toggleModifier(id: string) {
		// Handle mutex groups: turning on a modifier in a mutex group turns off
		// any other modifier in the same group.
		const modifier = IPA_MODIFIERS.find(m => m.id === id)
		if (!modifier) return
		if (selectedModifiers.has(id)) {
			selectedModifiers.delete(id)
			return
		}
		if (modifier.mutex) {
			for (const other of IPA_MODIFIERS) {
				if (other.mutex === modifier.mutex && other.id !== id) {
					selectedModifiers.delete(other.id)
				}
			}
		}
		selectedModifiers.add(id)
	}

	function commit() {
		if (!selected) return
		const composed: IpaEntry = { ...selected, symbol: composedSymbol }
		onpick(composed)
		open = false
	}

	function backToChart() {
		selected = null
	}

	function pairCellEntries(section: IpaSection, row: string, col: string): IpaEntry[] {
		const rowKey = section.id === 'vowels' ? 'height' : 'manner'
		const colKey = section.id === 'vowels' ? 'backness' : 'place'
		return section.entries.filter(e => (e as any)[rowKey] === row && (e as any)[colKey] === col)
	}
</script>

<Dialog
	bind:open
	title={selected ? 'Add modifiers' : 'Choose a phoneme'}
	subtitle={selected ? `Refine the base symbol /${selected.symbol}/ before adding` : undefined}
	mainClass="max-w-7xl"
>
	{#if selected}
		<!-- ─────────────────────────────────────────── refining phase ── -->
		<div class="space-y-5 pb-2">
			<!-- Live preview -->
			<div class="flex items-center justify-between gap-4 p-4 border border-border-subtle bg-raised">
				<div>
					<div class="text-xs uppercase tracking-wider text-dim mb-1">Result</div>
					<div class="font-serif text-4xl text-heading">/{composedSymbol}/</div>
					{#if selectedModifiers.size > 0}
						<div class="text-xs text-dim mt-1">
							{[...selectedModifiers]
								.map(id => IPA_MODIFIERS.find(m => m.id === id)?.label)
								.filter(Boolean)
								.join(' · ')}
						</div>
					{:else}
						<div class="text-xs text-faint mt-1">No modifiers — plain /{selected.symbol}/</div>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<Button variant="secondary" size="sm" onclick={backToChart}>
						<ArrowLeft size={14} weight="bold" /> Back
					</Button>
					<Button size="sm" onclick={commit} disabled={busy}>
						<Plus size={14} weight="bold" /> Add /{composedSymbol}/
					</Button>
				</div>
			</div>

			<!-- Modifier chips -->
			<div>
				<div class="text-xs uppercase tracking-wider text-dim mb-2">Modifiers</div>
				<div class="flex flex-wrap gap-1.5">
					{#each availableModifiers as modifier (modifier.id)}
						{@const active = selectedModifiers.has(modifier.id)}
						<button
							type="button"
							class="
								inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border transition-colors cursor-pointer
								{active
									? 'border-accent bg-accent-subtle text-accent'
									: 'border-border-subtle text-body hover:border-accent-border hover:bg-accent-subtle hover:text-accent'}
							"
							onclick={() => toggleModifier(modifier.id)}
							title={modifier.description}
						>
							<span>{modifier.label}</span>
							<span class="font-serif text-sm text-dim">/{selected.symbol}{modifier.suffix}/</span>
						</button>
					{/each}
				</div>
				<p class="text-xs text-faint mt-2">
					Click a modifier to toggle it. Mutually exclusive modifiers (e.g. long vs half-long) replace each other.
				</p>
			</div>
		</div>
	{:else}
		<!-- ──────────────────────────────────────────── picker phase ── -->
		<div class="space-y-8 pb-4">
			{#each visibleSections as section (section.id)}
				<section>
					<h4 class="text-heading font-medium mb-2 capitalize">{section.label}</h4>

					{#if section.columns && section.rows}
						<div class="overflow-x-auto">
							<table class="border border-border-subtle text-sm mx-auto">
								<thead>
									<tr>
										<th class="px-2 py-1 border-b border-r border-border-subtle bg-muted text-heading text-left capitalize">
											{section.id === 'vowels' ? 'Height' : 'Manner'}
										</th>
										{#each section.columns as col (col)}
											<th class="px-2 py-1 border-b border-r border-border-subtle bg-muted text-heading font-medium capitalize text-center">{col}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each section.rows as row (row)}
										<tr>
											<th class="px-2 py-1 border-b border-r border-border-subtle bg-raised text-body text-left font-medium capitalize">{row}</th>
											{#each section.columns as col (col)}
												{@const entries = pairCellEntries(section, row, col)}
												<td class="p-1 border-b border-r border-border-subtle text-center align-middle min-w-12">
													{#if entries.length > 0}
														<span class="inline-flex gap-1 justify-center">
															{#each entries as entry (entry.symbol)}
																<button
																	type="button"
																	class="
																		font-serif text-base px-1.5 py-0.5 rounded-sm cursor-pointer transition-colors
																		hover:bg-accent-subtle hover:text-accent
																		disabled:opacity-50 disabled:cursor-wait
																	"
																	onclick={() => selectEntry(entry)}
																	disabled={busy}
																	title="{entry.symbol} — {[entry.voicing, row, col].filter(Boolean).join(' ')}"
																>
																	{entry.symbol}
																</button>
															{/each}
														</span>
													{/if}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<!-- Flat sections: affricates, non-pulmonic, co-articulated, diphthongs -->
						<div class="flex flex-wrap gap-1.5">
							{#each section.entries as entry (entry.symbol)}
								<button
									type="button"
									class="
										font-serif text-base px-2 py-1 rounded-sm border border-border-subtle cursor-pointer transition-colors
										hover:bg-accent-subtle hover:text-accent
										disabled:opacity-50 disabled:cursor-wait
									"
									onclick={() => selectEntry(entry)}
									disabled={busy}
									title="{entry.symbol}{entry.place ? ' — ' + entry.place : ''}{entry.manner ? ' ' + entry.manner : ''}"
								>
									{entry.symbol}
								</button>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</Dialog>
