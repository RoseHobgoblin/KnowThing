<script lang="ts">
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let { title }: { title: string } = $props()
</script>

<tr >
	<th colspan="2" class="infobox-section">
		<InlineMarkup text={title} />
	</th>
</tr>
