<script lang="ts">
	import type { FieldMap } from './types.js'
	import { getField, getRemainingFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection from './InfoboxSection.svelte'

	let { fields }: { fields: FieldMap } = $props()

	const KNOWN_KEYS = new Set([
		'name', 'image', 'caption', 'image_size',
		'system_type', 'stars', 'star_count',
		'planets', 'satellites',
		'description',
	])

	const title = $derived(getField(fields, 'name') ?? '')
	const image = $derived(getField(fields, 'image') ?? '')
	const imageCaption = $derived(getField(fields, 'caption') ?? '')
	const systemType = $derived(getField(fields, 'system_type') ?? '')

	const starsList = $derived(getField(fields, 'stars') ?? '')
	const starCount = $derived(getField(fields, 'star_count') ?? '')
	const planets = $derived(getField(fields, 'planets') ?? '')
	const satellites = $derived(getField(fields, 'satellites') ?? '')

	const typeLabel = $derived(systemType
		? systemType.charAt(0).toUpperCase() + systemType.slice(1) + ' star system'
		: 'Star system')

	const remaining = $derived(getRemainingFields(fields, KNOWN_KEYS))
</script>


<InfoboxShell {title} {image} {imageCaption}>
	<InfoboxSection title="System">
	<InfoboxRow label="Type" value={typeLabel} />
	<InfoboxRow label="Stars" value={starsList} />
	{#if starCount && Number(starCount) > 1}
		<InfoboxRow label="Star count" value={starCount} />
	{/if}
	</InfoboxSection>

	<InfoboxSection title="Bodies">
	<InfoboxRow label="Planets" value={planets} />
	{#if satellites && satellites !== '0'}
		<InfoboxRow label="Satellites" value={satellites} />
	{/if}
	</InfoboxSection>

	{#if remaining.length > 0}
		<InfoboxSection>
			{#each remaining as [key, value] (key)}
				<InfoboxRow label={key} {value} />
			{/each}
		</InfoboxSection>
	{/if}
</InfoboxShell>
