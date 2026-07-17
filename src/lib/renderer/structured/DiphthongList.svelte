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
		<div class="bg-raised px-4 py-2.5 text-center mx-auto w-fit">
			<span class="phoneme-cell inline-flex gap-3">
				{#each rows as phoneme}
					<span
						class="font-serif text-base {phoneme.marginal ? 'text-dim' : ''}"
						title={phoneme.notes ?? undefined}
					>
						{#if phoneme.marginal}({phoneme.ipa}){:else}{phoneme.ipa}{/if}
					</span>
				{/each}
			</span>
		</div>
	</figure>
{/if}
