<script lang="ts">
	import type { FieldMap } from './types.js'
	import { getField, getRemainingFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection from './InfoboxSection.svelte'

	let { fields }: { fields: FieldMap } = $props()

	const KNOWN_KEYS = new Set([
		'name', 'image', 'caption', 'image_size',
		'type', 'classification', 'theology',
		'founder', 'origin', 'founded',
		'scripture', 'deity', 'deities',
		'followers', 'adherents', 'members',
		'leader', 'authority', 'headquarters',
		'language', 'branches', 'denominations',
		'separations', 'merged_into',
		'region', 'territories',
	])

	const title = getField(fields, 'name') ?? ''
	const image = getField(fields, 'image') ?? ''
	const imageCaption = getField(fields, 'caption') ?? ''
	const type = getField(fields, 'type', 'classification') ?? ''
	const theology = getField(fields, 'theology') ?? ''
	const founder = getField(fields, 'founder') ?? ''
	const origin = getField(fields, 'origin', 'founded') ?? ''
	const scripture = getField(fields, 'scripture') ?? ''
	const deity = getField(fields, 'deity', 'deities') ?? ''
	const followers = getField(fields, 'followers', 'adherents', 'members') ?? ''
	const leader = getField(fields, 'leader', 'authority') ?? ''
	const headquarters = getField(fields, 'headquarters') ?? ''
	const language = getField(fields, 'language') ?? ''
	const branches = getField(fields, 'branches', 'denominations') ?? ''
	const region = getField(fields, 'region', 'territories') ?? ''

	const remaining = getRemainingFields(fields, KNOWN_KEYS)
</script>

<InfoboxShell
	{title}
	subtitle={type}
	{image}
	{imageCaption}
>
	<InfoboxRow label="Theology" value={theology} />
	<InfoboxRow label="Deity" value={deity} />
	<InfoboxRow label="Scripture" value={scripture} />
	<InfoboxRow label="Founder" value={founder} />
	<InfoboxRow label="Origin" value={origin} />
	<InfoboxRow label="Followers" value={followers} />
	<InfoboxRow label="Leader" value={leader} />
	<InfoboxRow label="Headquarters" value={headquarters} />
	<InfoboxRow label="Sacred language" value={language} />
	<InfoboxRow label="Branches" value={branches} />
	<InfoboxRow label="Region" value={region} />

	{#each remaining as [key, value]}
		<InfoboxRow label={key} {value} />
	{/each}
</InfoboxShell>
