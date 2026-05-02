<script lang="ts">
	import type { FieldMap } from './types.js'
	import { getField, getNumberedFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection from './InfoboxSection.svelte'
	import MediaImage from '$lib/components/MediaImage.svelte'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let { fields }: { fields: FieldMap } = $props()

	const title = getField(fields, 'conventional_long_name', 'name', 'common_name') ?? ''
	const nativeName = getField(fields, 'native_name') ?? ''

	const flagImage = getField(fields, 'image_flag', 'flag') ?? ''
	const flagCaption = getField(fields, 'flag_caption', 'flag_type') ?? (flagImage ? 'Flag' : '')
	const flagAlt = getField(fields, 'alt_flag', 'flag_alt') ?? flagCaption

	const coatImage = getField(fields, 'image_coat', 'image_symbol', 'coat_of_arms') ?? ''
	const coatCaption = getField(fields, 'symbol_type') ?? (coatImage ? 'Coat of arms' : '')
	const coatAlt = getField(fields, 'alt_coat', 'coat_alt', 'alt_symbol') ?? coatCaption

	const fallbackImage = !flagImage && !coatImage ? (getField(fields, 'image') ?? '') : ''
	const fallbackCaption = fallbackImage ? (getField(fields, 'caption') ?? '') : ''
	const motto = getField(fields, 'national_motto', 'motto') ?? ''
	const anthem = getField(fields, 'national_anthem', 'anthem') ?? ''
	const capital = getField(fields, 'capital') ?? ''
	const largestCity = getField(fields, 'largest_city', 'largest_settlement') ?? ''
	const officialLangs = getField(fields, 'official_languages', 'languages') ?? ''
	const religion = getField(fields, 'religion') ?? ''
	const demonym = getField(fields, 'demonym') ?? ''
	const govType = getField(fields, 'government_type', 'government') ?? ''
	const legislature = getField(fields, 'legislature') ?? ''
	const areaKm2 = getField(fields, 'area_km2', 'area') ?? ''
	const population = getField(fields, 'population_census', 'population', 'population_estimate') ?? ''
	const popYear = getField(fields, 'population_census_year', 'population_year', 'population_estimate_year') ?? ''
	const currency = getField(fields, 'currency') ?? ''
	const timeZone = getField(fields, 'time_zone') ?? ''
	const leaders = getNumberedFields(fields, 'leader_title', 14)
	const established = getNumberedFields(fields, 'established_event', 13)
</script>

<InfoboxShell
	title={title}
	subtitle={nativeName}
	image={fallbackImage}
	imageCaption={fallbackCaption}
>
	{#if flagImage || coatImage}
		<tr>
			<td colspan="2" class="p-3 border-b border-border-subtle">
				<div class="flex items-start justify-center gap-4 flex-wrap">
					{#if flagImage}
						<figure class="flex flex-col items-center gap-1 m-0">
							<MediaImage
								filename={flagImage}
								alt={flagAlt}
								caption={flagCaption}
								displayWidth={150}
								sizes="150px"
								class="max-w-[150px] h-auto border border-border-subtle"
							/>
							{#if flagCaption}
								<figcaption class="text-xs text-dim text-center">
									<InlineMarkup text={flagCaption} />
								</figcaption>
							{/if}
						</figure>
					{/if}
					{#if coatImage}
						<figure class="flex flex-col items-center gap-1 m-0">
							<MediaImage
								filename={coatImage}
								alt={coatAlt}
								caption={coatCaption}
								displayWidth={100}
								sizes="100px"
								class="max-w-[100px] h-auto"
							/>
							{#if coatCaption}
								<figcaption class="text-xs text-dim text-center">
									<InlineMarkup text={coatCaption} />
								</figcaption>
							{/if}
						</figure>
					{/if}
				</div>
			</td>
		</tr>
	{/if}

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
