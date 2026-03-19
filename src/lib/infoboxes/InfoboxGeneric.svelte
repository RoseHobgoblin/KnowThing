<script lang="ts">
	import type { FieldMap } from './types.js';
	import { getField } from './types.js';
	import InfoboxShell from './InfoboxShell.svelte';
	import InfoboxRow from './InfoboxRow.svelte';

	let { fields }: { fields: FieldMap } = $props();

	const title = getField(fields, 'name', 'title') ?? '';
	const image = getField(fields, 'image') ?? '';
	const imageCaption = getField(fields, 'caption', 'imagecaption') ?? '';

	const skipKeys = new Set(['name', 'title', 'image', 'caption', 'imagecaption', 'image_size']);

	// Render all remaining named fields as generic rows
	const rows: [string, string][] = [];
	for (const [key, value] of fields) {
		if (!skipKeys.has(key) && value && !/^\d+$/.test(key)) {
			rows.push([key, value]);
		}
	}
</script>

<InfoboxShell
	{title}
	{image}
	{imageCaption}
>
	{#each rows as [label, value]}
		<InfoboxRow {label} {value} />
	{/each}
</InfoboxShell>
