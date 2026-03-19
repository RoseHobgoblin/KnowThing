<script lang="ts">
	import type { FieldMap } from './types.js';
	import { getField } from './types.js';
	import InfoboxShell from './InfoboxShell.svelte';
	import InfoboxRow from './InfoboxRow.svelte';
	import InfoboxSection from './InfoboxSection.svelte';

	let { fields }: { fields: FieldMap } = $props();

	const honorificPrefix = getField(fields, 'honorific_prefix') ?? '';
	const name = getField(fields, 'name') ?? '';
	const honorificSuffix = getField(fields, 'honorific_suffix') ?? '';
	const image = getField(fields, 'image', 'smallimage') ?? '';
	const imageCaption = getField(fields, 'caption') ?? '';
	const nativeName = getField(fields, 'native_name') ?? '';
	const birthDate = getField(fields, 'birth_date') ?? '';
	const birthPlace = getField(fields, 'birth_place') ?? '';
	const deathDate = getField(fields, 'death_date') ?? '';
	const deathPlace = getField(fields, 'death_place') ?? '';

	const fullTitle = [honorificPrefix, name, honorificSuffix].filter(Boolean).join(' ');

	interface OfficeBlock {
		index: number;
		office: string;
		order: string;
		termStart: string;
		termEnd: string;
		predecessor: string;
		successor: string;
		monarch: string;
		president: string;
		primeminister: string;
	}

	function getOfficeBlocks(): OfficeBlock[] {
		const blocks: OfficeBlock[] = [];
		for (let i = 0; i <= 16; i++) {
			const suffix = i === 0 ? '' : String(i);
			const office = getField(fields, `office${suffix}`);
			if (!office) continue;
			blocks.push({
				index: i,
				office,
				order: getField(fields, `order${suffix}`) ?? '',
				termStart: getField(fields, `term_start${suffix}`) ?? '',
				termEnd: getField(fields, `term_end${suffix}`) ?? '',
				predecessor: getField(fields, `predecessor${suffix}`) ?? '',
				successor: getField(fields, `successor${suffix}`) ?? '',
				monarch: getField(fields, `monarch${suffix}`) ?? '',
				president: getField(fields, `president${suffix}`) ?? '',
				primeminister: getField(fields, `primeminister${suffix}`) ?? ''
			});
		}
		return blocks;
	}

	const officeBlocks = getOfficeBlocks();
</script>

<InfoboxShell
	title={fullTitle}
	subtitle={nativeName}
	{image}
	{imageCaption}
>
	{#each officeBlocks as block}
		<InfoboxSection title={block.office} />
		{#if block.order}
			<InfoboxRow label="Order" value={block.order} />
		{/if}
		{#if block.termStart || block.termEnd}
			<InfoboxRow label="In office" value={`${block.termStart}${block.termEnd ? ` – ${block.termEnd}` : ' – present'}`} />
		{/if}
		<InfoboxRow label="Monarch" value={block.monarch} />
		<InfoboxRow label="President" value={block.president} />
		<InfoboxRow label="Prime Minister" value={block.primeminister} />
		<InfoboxRow label="Preceded by" value={block.predecessor} />
		<InfoboxRow label="Succeeded by" value={block.successor} />
	{/each}

	<InfoboxSection title="Personal Details" />
	<InfoboxRow label="Born" value={birthDate ? `${birthDate}${birthPlace ? `, ${birthPlace}` : ''}` : ''} />
	{#if deathDate}
		<InfoboxRow label="Died" value={`${deathDate}${deathPlace ? `, ${deathPlace}` : ''}`} />
	{/if}
</InfoboxShell>
