<script lang="ts">
	import type { FieldMap } from './types.js';
	import { getField, getNumberedFields } from './types.js';
	import InfoboxShell from './InfoboxShell.svelte';
	import InfoboxRow from './InfoboxRow.svelte';
	import InfoboxSection from './InfoboxSection.svelte';

	let { fields }: { fields: FieldMap } = $props();

	const title = getField(fields, 'name', 'title') ?? '';
	const image = getField(fields, 'image') ?? '';
	const imageCaption = getField(fields, 'caption') ?? '';
	const fullName = getField(fields, 'full_name') ?? '';
	const nativeName = getField(fields, 'native_name') ?? '';
	const birthName = getField(fields, 'birth_name') ?? '';
	const birthDate = getField(fields, 'birth_date') ?? '';
	const birthPlace = getField(fields, 'birth_place') ?? '';
	const deathDate = getField(fields, 'death_date') ?? '';
	const deathPlace = getField(fields, 'death_place') ?? '';
	const burialPlace = getField(fields, 'burial_place') ?? '';
	const spouse = getField(fields, 'spouse', 'consort') ?? '';
	const consortType = getField(fields, 'consort_type') ?? 'Consort';
	const issue = getField(fields, 'issue') ?? '';
	const royalHouse = getField(fields, 'royal_house', 'house', 'dynasty') ?? '';
	const father = getField(fields, 'father') ?? '';
	const mother = getField(fields, 'mother') ?? '';
	const religion = getField(fields, 'religion') ?? '';

	// Succession blocks (up to 10)
	interface SuccessionBlock {
		index: number;
		succession: string;
		reign: string;
		reignType: string;
		coronation: string;
		predecessor: string;
		successor: string;
		regent: string;
	}

	function getSuccessionBlocks(): SuccessionBlock[] {
		const blocks: SuccessionBlock[] = [];
		for (let i = 0; i <= 10; i++) {
			const suffix = i === 0 ? '' : String(i);
			const succession = getField(fields, `succession${suffix}`);
			if (!succession) continue;
			blocks.push({
				index: i,
				succession,
				reign: getField(fields, `reign${suffix}`) ?? '',
				reignType: getField(fields, `reign_type${suffix}`) ?? 'Reign',
				coronation: getField(fields, `coronation${suffix}`) ?? '',
				predecessor: getField(fields, `predecessor${suffix}`) ?? '',
				successor: getField(fields, `successor${suffix}`) ?? '',
				regent: getField(fields, `regent${suffix}`) ?? ''
			});
		}
		return blocks;
	}

	const successionBlocks = getSuccessionBlocks();
</script>

<InfoboxShell
	{title}
	{image}
	{imageCaption}
>
	{#each successionBlocks as block}
		<InfoboxSection title={block.succession} />
		<InfoboxRow label={block.reignType} value={block.reign} />
		{#if block.coronation}
			<InfoboxRow label="Coronation" value={block.coronation} />
		{/if}
		<InfoboxRow label="Predecessor" value={block.predecessor} />
		<InfoboxRow label="Successor" value={block.successor} />
		{#if block.regent}
			<InfoboxRow label="Regent" value={block.regent} />
		{/if}
	{/each}

	<InfoboxSection title="Personal Details" />
	<InfoboxRow label="Full name" value={fullName} />
	<InfoboxRow label="Native name" value={nativeName} />
	<InfoboxRow label="Birth name" value={birthName} />
	<InfoboxRow label="Born" value={birthDate ? `${birthDate}${birthPlace ? `, ${birthPlace}` : ''}` : ''} />
	{#if deathDate}
		<InfoboxRow label="Died" value={`${deathDate}${deathPlace ? `, ${deathPlace}` : ''}`} />
	{/if}
	<InfoboxRow label="Burial" value={burialPlace} />
	<InfoboxRow label={consortType} value={spouse} />
	<InfoboxRow label="Issue" value={issue} />
	<InfoboxRow label="House" value={royalHouse} />
	<InfoboxRow label="Father" value={father} />
	<InfoboxRow label="Mother" value={mother} />
	<InfoboxRow label="Religion" value={religion} />
</InfoboxShell>
