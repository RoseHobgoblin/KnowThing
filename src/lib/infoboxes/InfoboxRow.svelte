<script lang="ts">
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let {
		label,
		value,
	}: {
		label: string
		value: string
	} = $props()
</script>

{#if value}
	<div class="infobox-row">
		<div class="infobox-label">
			<InlineMarkup text={label} />
		</div>
		<div class="infobox-data">
			<InlineMarkup text={value} />
		</div>
	</div>
{/if}
