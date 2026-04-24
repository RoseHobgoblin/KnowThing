<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte'
	import { IPA_SECTIONS, type IpaEntry, type IpaSection } from '$lib/data/ipa-chart.js'

	let {
		open = $bindable(false),
		onpick,
	}: {
		open?: boolean
		onpick: (entry: IpaEntry) => void
	} = $props()

	function handlePick(entry: IpaEntry) {
		onpick(entry)
		open = false
	}

	function findEntry(section: IpaSection, row: string, col: string, preferVoicing?: 'voiced' | 'voiceless'): IpaEntry | undefined {
		const rowKey = section.id === 'vowels' ? 'height' : 'manner'
		const colKey = section.id === 'vowels' ? 'backness' : 'place'
		const matches = section.entries.filter(e => (e as any)[rowKey] === row && (e as any)[colKey] === col)
		if (matches.length === 0) return undefined
		if (preferVoicing) return matches.find(m => m.voicing === preferVoicing) ?? matches[0]
		return matches[0]
	}

	function pairCellEntries(section: IpaSection, row: string, col: string): IpaEntry[] {
		const rowKey = section.id === 'vowels' ? 'height' : 'manner'
		const colKey = section.id === 'vowels' ? 'backness' : 'place'
		return section.entries.filter(e => (e as any)[rowKey] === row && (e as any)[colKey] === col)
	}
</script>

<Dialog bind:open title="Choose a phoneme" mainClass="max-w-5xl">
	<div class="space-y-8 pb-4">
		{#each IPA_SECTIONS as section}
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
									{#each section.columns as col}
										<th class="px-2 py-1 border-b border-r border-border-subtle bg-muted text-heading font-medium capitalize text-center">{col}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each section.rows as row}
									<tr>
										<th class="px-2 py-1 border-b border-r border-border-subtle bg-raised text-body text-left font-medium capitalize">{row}</th>
										{#each section.columns as col}
											{@const entries = pairCellEntries(section, row, col)}
											<td class="p-1 border-b border-r border-border-subtle text-center align-middle min-w-12">
												{#if entries.length > 0}
													<span class="inline-flex gap-1 justify-center">
														{#each entries as entry}
															<button
																type="button"
																class="font-serif text-base px-1.5 py-0.5 rounded-sm cursor-pointer transition-colors hover:bg-accent-subtle hover:text-accent"
																onclick={() => handlePick(entry)}
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
						{#each section.entries as entry}
							<button
								type="button"
								class="font-serif text-base px-2 py-1 rounded-sm border border-border-subtle cursor-pointer transition-colors hover:bg-accent-subtle hover:text-accent"
								onclick={() => handlePick(entry)}
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
</Dialog>
