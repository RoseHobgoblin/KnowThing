<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '$lib/templates/args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import { buildPhonemeGrid, cellKey, footnoteIndex, type PhonemeRow } from './phoneme-grid.js'

	let {
		args,
		type,
	}: { args: TemplateArg[], type: 'consonant' | 'vowel' } = $props()

	const ctx = getKnowContext()
	const slug = $derived(positionalArg(args, 0)?.trim() ?? '')
	const key = $derived(`${type === 'consonant' ? 'consonants' : 'vowels'}:${slug}`)
	const rows = $derived((ctx.structuredCollections?.[key] ?? null) as PhonemeRow[] | null)
	const grid = $derived(buildPhonemeGrid(rows, type))
</script>

{#if !slug}
	<span class="text-secondary">[{type}s: missing language slug]</span>
{:else if !grid}
	<span class="text-secondary">[{type}s: no data for "{slug}"]</span>
{:else}
	<figure class="my-4 phoneme-grid">
		<table class="text-sm mx-auto">
			<thead>
				<tr>
					<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-left text-heading capitalize">
						{type === 'consonant' ? 'Manner' : 'Height'}
					</th>
					{#each grid.columns as col}
						<th class="px-3 py-2 border-b border-r border-border-subtle bg-muted text-heading font-medium capitalize text-center">{col}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each grid.rows as row}
					<tr>
						<th class="px-3 py-1.5 border-b border-r border-border-subtle bg-raised text-left font-medium capitalize text-body">
							{row.header}{#if row.subtype} <span class="text-dim text-xs">({row.subtype})</span>{/if}
						</th>
						{#each grid.columns as col}
							{@const list = grid.cells.get(cellKey(row, col)) ?? []}
							<td class="px-3 py-1.5 border-b border-r border-border-subtle text-center align-middle">
								{#if list.length > 0}
									<span class="phoneme-cell inline-flex gap-1.5">
										{#each list as p}
											<span
												class="font-serif text-base {p.marginal ? 'text-dim' : ''}"
												title={p.marginal ? `marginal: ${p.notes ?? p.ipa}` : p.notes ?? undefined}
											>
												{#if p.marginal}({p.ipa}){:else}{p.ipa}{/if}
												{#if p.notes?.trim()}
													{@const function_ = footnoteIndex(p.ipa, grid.footnotes)}
													{#if function_ !== null}<sup class="text-dim text-xs">{function_}</sup>{/if}
												{/if}
											</span>
										{/each}
									</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
		{#if grid.footnotes.length > 0}
			<figcaption class="mt-2 text-xs text-dim max-w-prose mx-auto">
				<ol class="list-none pl-0 space-y-0.5">
					{#each grid.footnotes as function_}
						<li><sup>{function_.index}</sup> <span class="font-serif">{function_.ipa}</span>: {function_.text}</li>
					{/each}
				</ol>
			</figcaption>
		{/if}
	</figure>
{/if}
