<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '$lib/templates/args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import type { PhonemeRow } from './phoneme-grid.js'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const slug = $derived(positionalArg(args, 0)?.trim() ?? '')
	const rows = $derived((ctx.structuredCollections?.[`diphthongs:${slug}`] ?? null) as PhonemeRow[] | null)
</script>

{#if slug && rows && rows.length > 0}
	<figure class="my-4 diphthong-list">
		<table class="know-table text-sm">
			<tbody>
				<tr>
				{#each rows as phoneme, index (index)}
					<td
						class="font-serif text-base {phoneme.marginal ? 'text-dim' : ''}"
						title={phoneme.notes ?? undefined}
					>
						{#if phoneme.marginal}({phoneme.ipa}){:else}{phoneme.ipa}{/if}
					</td>
				{/each}
				</tr>
			</tbody>
		</table>
	</figure>
{/if}
