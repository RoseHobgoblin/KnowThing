<script lang="ts">
	import type { FieldMap } from './types.js';
	import { getField, getNumberedFields } from './types.js';
	import InfoboxShell from './InfoboxShell.svelte';
	import InfoboxRow from './InfoboxRow.svelte';
	import InfoboxSection from './InfoboxSection.svelte';

	let { fields }: { fields: FieldMap } = $props();

	const title = getField(fields, 'name', 'official_name') ?? '';
	const nativeName = getField(fields, 'native_name', 'other_name') ?? '';
	const settlementType = getField(fields, 'settlement_type', 'type') ?? '';
	const image = getField(fields, 'image_skyline', 'image') ?? '';
	const imageCaption = getField(fields, 'image_caption', 'caption') ?? '';
	const nickname = getField(fields, 'nickname') ?? '';
	const motto = getField(fields, 'motto') ?? '';
	const etymology = getField(fields, 'etymology') ?? '';
	const coordinates = getField(fields, 'coordinates') ?? '';
	const govType = getField(fields, 'government_type', 'government') ?? '';
	const mayor = getField(fields, 'mayor') ?? '';
	const areaTotal = getField(fields, 'area_total_km2', 'area_km2') ?? '';
	const elevation = getField(fields, 'elevation_m') ?? '';
	const population = getField(fields, 'population_total', 'population') ?? '';
	const popAsOf = getField(fields, 'population_as_of') ?? '';
	const popDensity = getField(fields, 'population_density_km2') ?? '';
	const timezone = getField(fields, 'timezone', 'time_zone') ?? '';
	const postalCode = getField(fields, 'postal_code') ?? '';
	const areaCode = getField(fields, 'area_code') ?? '';
	const founder = getField(fields, 'founder') ?? '';
	const namedFor = getField(fields, 'named_for') ?? '';

	const subdivisions = getNumberedFields(fields, 'subdivision_type', 6);
	const established = getNumberedFields(fields, 'established_title', 7);
	const leaders = getNumberedFields(fields, 'leader_title', 16);
</script>

<InfoboxShell
	{title}
	subtitle={settlementType || nativeName}
	{image}
	{imageCaption}
>
	<InfoboxRow label="Nickname" value={nickname} />
	<InfoboxRow label="Motto" value={motto} />
	<InfoboxRow label="Etymology" value={etymology} />
	<InfoboxRow label="Coordinates" value={coordinates} />

	{#if subdivisions.length > 0}
		{#each subdivisions as sub}
			{@const nameField = getField(fields, `subdivision_name${sub.index || ''}`, `subdivision_name${sub.index}`)}
			{#if nameField}
				<InfoboxRow label={sub.value} value={nameField} />
			{/if}
		{/each}
	{/if}

	{#if founder || namedFor || established.length > 0}
		<InfoboxSection title="Founding" />
		<InfoboxRow label="Founded by" value={founder} />
		<InfoboxRow label="Named for" value={namedFor} />
		{#each established as est}
			{@const dateField = getField(fields, `established_date${est.index || ''}`, `established_date${est.index}`)}
			{#if dateField}
				<InfoboxRow label={est.value} value={dateField} />
			{/if}
		{/each}
	{/if}

	{#if govType || mayor || leaders.length > 0}
		<InfoboxSection title="Government" />
		<InfoboxRow label="Type" value={govType} />
		<InfoboxRow label="Mayor" value={mayor} />
		{#each leaders as leader}
			{@const nameField = getField(fields, `leader_name${leader.index || ''}`, `leader_name${leader.index}`)}
			{#if nameField}
				<InfoboxRow label={leader.value} value={nameField} />
			{/if}
		{/each}
	{/if}

	{#if areaTotal || elevation || population}
		<InfoboxSection title="Area & Population" />
		<InfoboxRow label="Total area" value={areaTotal ? `${areaTotal} km²` : ''} />
		<InfoboxRow label="Elevation" value={elevation ? `${elevation} m` : ''} />
		<InfoboxRow label="Population" value={population ? `${population}${popAsOf ? ` (${popAsOf})` : ''}` : ''} />
		<InfoboxRow label="Density" value={popDensity ? `${popDensity}/km²` : ''} />
	{/if}

	<InfoboxRow label="Time zone" value={timezone} />
	<InfoboxRow label="Postal code" value={postalCode} />
	<InfoboxRow label="Area code" value={areaCode} />
</InfoboxShell>
