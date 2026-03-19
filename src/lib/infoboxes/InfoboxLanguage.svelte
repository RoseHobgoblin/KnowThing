<script lang="ts">
	import type { FieldMap } from './types.js';
	import { getField, getNumberedFields } from './types.js';
	import InfoboxShell from './InfoboxShell.svelte';
	import InfoboxRow from './InfoboxRow.svelte';
	import InfoboxSection from './InfoboxSection.svelte';

	let { fields }: { fields: FieldMap } = $props();

	const title = getField(fields, 'name', 'nativename') ?? '';
	const nativeName = getField(fields, 'nativename', 'altname') ?? '';
	const image = getField(fields, 'image') ?? '';
	const imageCaption = getField(fields, 'imagecaption') ?? '';
	const pronunciation = getField(fields, 'pronunciation') ?? '';
	const states = getField(fields, 'states', 'state') ?? '';
	const region = getField(fields, 'region') ?? '';
	const ethnicity = getField(fields, 'ethnicity') ?? '';
	const speakers = getField(fields, 'speakers') ?? '';
	const speakersDate = getField(fields, 'date') ?? '';
	const extinct = getField(fields, 'extinct') ?? '';
	const era = getField(fields, 'era') ?? '';
	const familyColor = getField(fields, 'familycolor') ?? '';
	const family = getField(fields, 'family') ?? '';
	const script = getField(fields, 'script') ?? '';
	const creator = getField(fields, 'creator') ?? '';
	const created = getField(fields, 'created') ?? '';
	const nation = getField(fields, 'nation') ?? '';
	const agency = getField(fields, 'agency') ?? '';
	const iso1 = getField(fields, 'iso1') ?? '';
	const iso2 = getField(fields, 'iso2') ?? '';
	const iso3 = getField(fields, 'iso3') ?? '';
	const glotto = getField(fields, 'glotto') ?? '';

	// Language family chain: fam1, fam2, ... fam15
	const familyChain = getNumberedFields(fields, 'fam', 15);
	// Dialects: dia1, dia2, ... dia40
	const dialects = getNumberedFields(fields, 'dia', 40);
</script>

<InfoboxShell
	{title}
	subtitle={nativeName !== title ? nativeName : ''}
	{image}
	{imageCaption}
>
	<InfoboxRow label="Pronunciation" value={pronunciation} />
	<InfoboxRow label="Region" value={states || region} />
	<InfoboxRow label="Ethnicity" value={ethnicity} />

	{#if speakers || extinct}
		<InfoboxSection title="Speakers" />
		{#if speakers}
			<InfoboxRow label="Speakers" value={`${speakers}${speakersDate ? ` (${speakersDate})` : ''}`} />
		{/if}
		<InfoboxRow label="Extinct" value={extinct} />
		<InfoboxRow label="Era" value={era} />
	{/if}

	{#if family || familyChain.length > 0}
		<InfoboxSection title="Classification" />
		<InfoboxRow label="Family" value={family} />
		{#each familyChain as fam}
			<tr class="border-t border-stone-200">
				<td colspan="2" class="px-3 py-0.5 text-stone-700 text-xs" style="padding-left: {(fam.index + 1) * 12 + 12}px">
					{fam.value}
				</td>
			</tr>
		{/each}
	{/if}

	<InfoboxRow label="Writing system" value={script} />
	<InfoboxRow label="Creator" value={creator} />
	<InfoboxRow label="Created" value={created} />

	{#if dialects.length > 0}
		<InfoboxSection title="Dialects" />
		{#each dialects as dia}
			<tr class="border-t border-stone-100">
				<td colspan="2" class="px-3 py-0.5 text-stone-700 text-xs pl-6">
					{dia.value}
				</td>
			</tr>
		{/each}
	{/if}

	{#if nation || agency}
		<InfoboxSection title="Official Status" />
		<InfoboxRow label="Official in" value={nation} />
		<InfoboxRow label="Regulated by" value={agency} />
	{/if}

	{#if iso1 || iso2 || iso3 || glotto}
		<InfoboxSection title="Language Codes" />
		<InfoboxRow label="ISO 639-1" value={iso1} />
		<InfoboxRow label="ISO 639-2" value={iso2} />
		<InfoboxRow label="ISO 639-3" value={iso3} />
		<InfoboxRow label="Glottolog" value={glotto} />
	{/if}
</InfoboxShell>
