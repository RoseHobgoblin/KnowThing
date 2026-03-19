<script lang="ts">
	import type { FieldMap } from './types.js';
	import { getField, getNumberedFields } from './types.js';
	import InfoboxShell from './InfoboxShell.svelte';
	import InfoboxRow from './InfoboxRow.svelte';
	import InfoboxSection from './InfoboxSection.svelte';

	let { fields }: { fields: FieldMap } = $props();

	const title = getField(fields, 'conventional_long_name', 'name', 'common_name') ?? '';
	const nativeName = getField(fields, 'native_name') ?? '';
	const image = getField(fields, 'image_flag', 'flag', 'image') ?? '';
	const imageCaption = getField(fields, 'alt_flag', 'flag_caption') ?? '';
	const motto = getField(fields, 'national_motto', 'motto') ?? '';
	const anthem = getField(fields, 'national_anthem', 'anthem') ?? '';
	const capital = getField(fields, 'capital') ?? '';
	const largestCity = getField(fields, 'largest_city', 'largest_settlement') ?? '';
	const officialLangs = getField(fields, 'official_languages', 'languages') ?? '';
	const religion = getField(fields, 'religion') ?? '';
	const demonym = getField(fields, 'demonym') ?? '';
	const govType = getField(fields, 'government_type', 'government') ?? '';
	const legislature = getField(fields, 'legislature') ?? '';
	const areaKm2 = getField(fields, 'area_km2', 'area') ?? '';
	const population = getField(fields, 'population_census', 'population', 'population_estimate') ?? '';
	const popYear = getField(fields, 'population_census_year', 'population_year', 'population_estimate_year') ?? '';
	const currency = getField(fields, 'currency') ?? '';
	const timeZone = getField(fields, 'time_zone') ?? '';
	const leaders = getNumberedFields(fields, 'leader_title', 14);
	const established = getNumberedFields(fields, 'established_event', 13);
</script>

<InfoboxShell
	{title}
	subtitle={nativeName}
	{image}
	{imageCaption}
>
	{#if motto}
		<InfoboxRow label="Motto" value={motto} />
	{/if}
	{#if anthem}
		<InfoboxRow label="Anthem" value={anthem} />
	{/if}

	<InfoboxRow label="Capital" value={capital} />
	{#if largestCity && largestCity !== capital}
		<InfoboxRow label="Largest city" value={largestCity} />
	{/if}
	<InfoboxRow label="Official languages" value={officialLangs} />
	<InfoboxRow label="Religion" value={religion} />
	<InfoboxRow label="Demonym" value={demonym} />

	{#if govType || leaders.length > 0}
		<InfoboxSection title="Government" />
		<InfoboxRow label="Type" value={govType} />
		{#each leaders as leader}
			{@const nameField = getField(fields, `leader_name${leader.index || ''}`, `leader_name${leader.index}`)}
			{#if nameField}
				<InfoboxRow label={leader.value} value={nameField} />
			{/if}
		{/each}
		{#if legislature}
			<InfoboxRow label="Legislature" value={legislature} />
		{/if}
	{/if}

	{#if established.length > 0}
		<InfoboxSection title="Establishment" />
		{#each established as event}
			{@const dateField = getField(fields, `established_date${event.index || ''}`, `established_date${event.index}`)}
			{#if dateField}
				<InfoboxRow label={event.value} value={dateField} />
			{/if}
		{/each}
	{/if}

	{#if areaKm2 || population}
		<InfoboxSection title="Area & Population" />
		<InfoboxRow label="Total area" value={areaKm2 ? `${areaKm2} km²` : ''} />
		<InfoboxRow label="Population" value={population ? `${population}${popYear ? ` (${popYear})` : ''}` : ''} />
	{/if}

	<InfoboxRow label="Currency" value={currency} />
	<InfoboxRow label="Time zone" value={timeZone} />
</InfoboxShell>
