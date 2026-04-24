<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import PhonemeGrid from './PhonemeGrid.svelte'

	let { args }: { args: TemplateArg[] } = $props()
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
</div>
