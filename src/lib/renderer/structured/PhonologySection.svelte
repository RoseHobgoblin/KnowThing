<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '$lib/templates/args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import PhonemeGrid from './PhonemeGrid.svelte'
	import DiphthongList from './DiphthongList.svelte'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const slug = $derived(positionalArg(args, 0)?.trim() ?? '')
	const hasDiphthongs = $derived(
		((ctx.structuredCollections?.[`diphthongs:${slug}`] ?? []) as unknown[]).length > 0,
	)
</script>

<div class="phonology-section space-y-6 my-6">
	<section>
		<h3 class="text-heading font-medium mb-2">Consonants</h3>
		<PhonemeGrid {args} type="consonant" />
	</section>
	<section>
		<h3 class="text-heading font-medium mb-2">Vowels</h3>
		<PhonemeGrid {args} type="vowel" />
	</section>
	{#if hasDiphthongs}
		<section>
			<h3 class="text-heading font-medium mb-2">Diphthongs</h3>
			<DiphthongList {args} />
		</section>
	{/if}
</div>
