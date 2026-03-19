<script lang="ts">
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte';

	let {
		label,
		value
	}: {
		label: string;
		value: string;
	} = $props();
</script>

{#if value}
	<tr class="border-t border-stone-100">
		<th class="infobox-label">
			<InlineMarkup text={label} />
		</th>
		<td class="infobox-data">
			<InlineMarkup text={value} />
		</td>
	</tr>
{/if}
