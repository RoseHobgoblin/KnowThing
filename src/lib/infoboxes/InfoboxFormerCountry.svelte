<script lang="ts">
	import type { FieldMap } from './types.js';
	import { getField, getNumberedFields } from './types.js';
	import InfoboxShell from './InfoboxShell.svelte';
	import InfoboxRow from './InfoboxRow.svelte';
	import InfoboxSection from './InfoboxSection.svelte';

	let { fields }: { fields: FieldMap } = $props();

	const title = getField(fields, 'conventional_long_name', 'name', 'common_name') ?? '';
	const nativeName = getField(fields, 'native_name') ?? '';
	const status = getField(fields, 'status', 'status_text') ?? '';
	const yearStart = getField(fields, 'year_start') ?? '';
	const yearEnd = getField(fields, 'year_end') ?? '';
	const image = getField(fields, 'image_flag', 'image') ?? '';
	const capital = getField(fields, 'capital') ?? '';
	const govType = getField(fields, 'government_type', 'government') ?? '';
	const religion = getField(fields, 'religion') ?? '';
	const currency = getField(fields, 'currency') ?? '';
	const predecessor = getField(fields, 'predecessor') ?? '';
	const successor = getField(fields, 'successor') ?? '';
	const todayPartOf = getField(fields, 'today_part_of') ?? '';
	const established = getNumberedFields(fields, 'established_event', 13);

	const dateRange = yearStart || yearEnd ? `${yearStart}–${yearEnd}` : '';
</script>

<InfoboxShell
	{title}
	subtitle={nativeName || dateRange}
	{image}
>
	{#if status}
		<InfoboxRow label="Status" value={status} />
	{/if}
	{#if dateRange}
		<InfoboxRow label="Era" value={dateRange} />
	{/if}
	<InfoboxRow label="Capital" value={capital} />
	<InfoboxRow label="Government" value={govType} />
	<InfoboxRow label="Religion" value={religion} />
	<InfoboxRow label="Currency" value={currency} />

	{#if established.length > 0}
		<InfoboxSection title="History" />
		{#each established as event}
			{@const dateField = getField(fields, `established_date${event.index || ''}`, `established_date${event.index}`)}
			{#if dateField}
				<InfoboxRow label={event.value} value={dateField} />
			{/if}
		{/each}
	{/if}

	{#if predecessor || successor || todayPartOf}
		<InfoboxSection title="Succession" />
		<InfoboxRow label="Preceded by" value={predecessor} />
		<InfoboxRow label="Succeeded by" value={successor} />
		<InfoboxRow label="Today part of" value={todayPartOf} />
	{/if}
</InfoboxShell>
