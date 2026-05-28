<script lang="ts">
	import type { FieldMap } from './types.js'
	import type { InfoboxSchema, InfoboxRowSpec, InfoboxSection } from './schemas/types.js'
	import { knownKeys } from './schemas/types.js'
	import { getField, getRemainingFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection_ from './InfoboxSection.svelte'

	let { schema, fields }: { schema: InfoboxSchema, fields: FieldMap } = $props()

	function rowValue(row: InfoboxRowSpec): string {
		if (row.compose) return row.compose(fields).trim()
		return getField(fields, ...(row.keys ?? [])) ?? ''
	}

	type ResolvedSection = { heading?: string, rows: { label: string, value: string }[] }

	const resolvedSections: ResolvedSection[] = $derived.by(() => {
		const out: ResolvedSection[] = []
		for (const section of schema.sections as InfoboxSection[]) {
			const rows = section.rows.map(r => ({ label: r.label, value: rowValue(r) }))
			if (rows.some(r => r.value)) {
				out.push({ heading: section.heading, rows })
			}
		}
		return out
	})

	const title = $derived(getField(fields, ...schema.title) ?? '')
	const subtitle = $derived(schema.subtitle ? (getField(fields, ...schema.subtitle) ?? '') : '')
	const image = $derived(getField(fields, ...schema.image) ?? '')
	const imageCaption = $derived(getField(fields, ...schema.caption) ?? '')
	const remaining = $derived(getRemainingFields(fields, knownKeys(schema)))
</script>

<InfoboxShell {title} {subtitle} {image} {imageCaption}>
	{#each resolvedSections as section}
		{#if section.heading}
			<InfoboxSection_ title={section.heading} />
		{/if}
		{#each section.rows as row}
			<InfoboxRow label={row.label} value={row.value} />
		{/each}
	{/each}

	{#each remaining as [key, value]}
		<InfoboxRow label={key} {value} />
	{/each}
</InfoboxShell>
