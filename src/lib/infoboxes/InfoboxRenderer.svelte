<script lang="ts">
	import type { FieldMap } from './types.js'
	import type { InfoboxSchema, InfoboxRowSpec } from './schemas/types.js'
	import { knownKeys, isRepeatSection } from './schemas/types.js'
	import { getField, getRemainingFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection_ from './InfoboxSection.svelte'

	let { schema, fields }: { schema: InfoboxSchema, fields: FieldMap } = $props()

	function resolveRow(row: InfoboxRowSpec, suffix: string): { label: string, value: string } {
		const label = row.label || row.fallbackLabel || ''
		if (row.compose) return { label, value: row.compose(fields, suffix).trim() }
		const keys = (row.keys ?? []).map(k => `${k}${suffix}`)
		return { label, value: getField(fields, ...keys) ?? '' }
	}

	type ResolvedSection = { heading?: string, rows: { label: string, value: string }[] }

	const resolvedSections: ResolvedSection[] = $derived.by(() => {
		const out: ResolvedSection[] = []
		for (const section of schema.sections) {
			if (isRepeatSection(section)) {
				const { discoverKey, max } = section.repeat
				for (let index = 0; index <= max; index++) {
					const suffix = index === 0 ? '' : String(index)
					const heading = getField(fields, `${discoverKey}${suffix}`)
					if (!heading) continue
					const rows = section.rows.map(r => resolveRow(r, suffix))
					out.push({ heading, rows })
				}
			} else {
				const rows = section.rows.map(r => resolveRow(r, ''))
				if (rows.some(r => r.value)) {
					out.push({ heading: section.heading, rows })
				}
			}
		}
		return out
	})

	const title = $derived(schema.titleCompose ? schema.titleCompose(fields).trim() : (getField(fields, ...schema.title) ?? ''))
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
