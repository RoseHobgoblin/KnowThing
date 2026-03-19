<script lang="ts">
	import type { FieldMap } from './types.js';
	import { getField, getRemainingFields } from './types.js';
	import InfoboxShell from './InfoboxShell.svelte';
	import InfoboxRow from './InfoboxRow.svelte';

	let { fields }: { fields: FieldMap } = $props();

	const KNOWN_KEYS = new Set([
		'name', 'image', 'caption', 'image_size',
		'birth_name', 'birth_date', 'birth_place', 'born',
		'death_date', 'death_place', 'died',
		'nationality', 'occupation', 'title',
		'spouse', 'children', 'parents', 'father', 'mother',
		'education', 'alma_mater', 'awards', 'signature',
		'known_for', 'notable_works', 'religion',
		'predecessor', 'successor', 'reign'
	]);

	const title = getField(fields, 'name') ?? '';
	const image = getField(fields, 'image') ?? '';
	const imageCaption = getField(fields, 'caption') ?? '';
	const birthName = getField(fields, 'birth_name') ?? '';
	const birthDate = getField(fields, 'birth_date', 'born') ?? '';
	const birthPlace = getField(fields, 'birth_place') ?? '';
	const deathDate = getField(fields, 'death_date', 'died') ?? '';
	const deathPlace = getField(fields, 'death_place') ?? '';
	const nationality = getField(fields, 'nationality') ?? '';
	const occupation = getField(fields, 'occupation') ?? '';
	const knownFor = getField(fields, 'known_for', 'notable_works') ?? '';
	const spouse = getField(fields, 'spouse') ?? '';
	const children = getField(fields, 'children') ?? '';
	const father = getField(fields, 'father', 'parents') ?? '';
	const mother = getField(fields, 'mother') ?? '';
	const education = getField(fields, 'education', 'alma_mater') ?? '';
	const awards = getField(fields, 'awards') ?? '';
	const religion = getField(fields, 'religion') ?? '';

	// Fallback: render remaining fields that aren't in the known set
	const remaining = getRemainingFields(fields, KNOWN_KEYS);
</script>

<InfoboxShell
	{title}
	{image}
	{imageCaption}
>
	<InfoboxRow label="Birth name" value={birthName} />
	<InfoboxRow label="Born" value={birthDate ? `${birthDate}${birthPlace ? `, ${birthPlace}` : ''}` : ''} />
	{#if deathDate}
		<InfoboxRow label="Died" value={`${deathDate}${deathPlace ? `, ${deathPlace}` : ''}`} />
	{/if}
	<InfoboxRow label="Nationality" value={nationality} />
	<InfoboxRow label="Occupation" value={occupation} />
	<InfoboxRow label="Known for" value={knownFor} />
	<InfoboxRow label="Education" value={education} />
	<InfoboxRow label="Spouse" value={spouse} />
	<InfoboxRow label="Children" value={children} />
	<InfoboxRow label="Father" value={father} />
	<InfoboxRow label="Mother" value={mother} />
	<InfoboxRow label="Awards" value={awards} />
	<InfoboxRow label="Religion" value={religion} />

	{#each remaining as [key, value]}
		<InfoboxRow label={key} {value} />
	{/each}
</InfoboxShell>
