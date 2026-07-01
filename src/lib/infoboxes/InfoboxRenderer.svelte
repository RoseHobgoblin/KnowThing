<script lang="ts">
	import type { FieldMap } from './types.js'
	import type { InfoboxSchema, InfoboxRowSpec, StaticRow } from './schemas/types.js'
	import { knownKeys, isRepeatSection, isPairRow } from './schemas/types.js'
	import { getField, getRemainingFields } from './types.js'
	import InfoboxShell from './InfoboxShell.svelte'
	import InfoboxRow from './InfoboxRow.svelte'
	import InfoboxSection_ from './InfoboxSection.svelte'
	import MediaImage from '$lib/components/MediaImage.svelte'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let { schema, fields }: { schema: InfoboxSchema, fields: FieldMap } = $props()

	type ResolvedRow = { label: string, value: string }

	function resolveStaticRow(row: StaticRow, suffix: string): ResolvedRow {
		if (row.compose) return { label: row.label, value: row.compose(fields, suffix).trim() }
		const keys = (row.keys ?? []).map(k => `${k}${suffix}`)
		return { label: row.label, value: getField(fields, ...keys) ?? '' }
	}

	function expandRow(row: InfoboxRowSpec, suffix: string): ResolvedRow[] {
		if (isPairRow(row)) {
			const out: ResolvedRow[] = []
			const { labelKey, valueKey, max } = row.pair
			for (let index = 0; index <= max; index++) {
				const pairSuffix = index === 0 ? '' : String(index)
				const label = getField(fields, `${labelKey}${pairSuffix}`) ?? ''
				const value = getField(fields, `${valueKey}${pairSuffix}`) ?? ''
				if (label && value) out.push({ label, value })
			}
			return out
		}
		return [resolveStaticRow(row, suffix)]
	}

	type ResolvedSection = { heading?: string, rows: ResolvedRow[] }

	const resolvedSections: ResolvedSection[] = $derived.by(() => {
		const out: ResolvedSection[] = []
		for (const section of schema.sections) {
			if (isRepeatSection(section)) {
				const { discoverKey, max } = section.repeat
				for (let index = 0; index <= max; index++) {
					const suffix = index === 0 ? '' : String(index)
					const heading = getField(fields, `${discoverKey}${suffix}`)
					if (!heading) continue
					const rows = section.rows.flatMap(r => expandRow(r, suffix))
					out.push({ heading, rows })
				}
			} else {
				const rows = section.rows.flatMap(r => expandRow(r, ''))
				if (rows.some(r => r.value)) {
					out.push({ heading: section.heading, rows })
				}
			}
		}
		return out
	})

	const title = $derived(schema.titleCompose ? schema.titleCompose(fields).trim() : (getField(fields, ...schema.title) ?? ''))
	const subtitle = $derived(
		schema.subtitleCompose
			? schema.subtitleCompose(fields).trim()
			: (schema.subtitle ? (getField(fields, ...schema.subtitle) ?? '') : ''),
	)

	type ResolvedHeaderImage = { file: string, caption: string, alt: string, width: number }

	const resolvedHeaderImages: ResolvedHeaderImage[] = $derived.by(() => {
		if (!schema.headerImages) return []
		const out: ResolvedHeaderImage[] = []
		for (const spec of schema.headerImages) {
			const file = getField(fields, ...spec.fileKeys) ?? ''
			if (!file) continue
			const caption = getField(fields, ...(spec.captionKeys ?? [])) ?? spec.defaultCaption ?? ''
			const alt = getField(fields, ...(spec.altKeys ?? [])) ?? caption
			out.push({ file, caption, alt, width: spec.width ?? 150 })
		}
		return out
	})

	const hasHeaderImages = $derived(resolvedHeaderImages.length > 0)
	const image = $derived(hasHeaderImages ? '' : (getField(fields, ...schema.image) ?? ''))
	const imageCaption = $derived(hasHeaderImages ? '' : (getField(fields, ...schema.caption) ?? ''))
	const remaining = $derived(getRemainingFields(fields, knownKeys(schema)))
</script>

<InfoboxShell {title} {subtitle} {image} {imageCaption}>
	{#if hasHeaderImages}
		<tr>
			<td colspan="2" class="p-3">
				<div class="flex items-start justify-center gap-4 flex-wrap">
					{#each resolvedHeaderImages as img}
						<figure class="flex flex-col items-center gap-1 m-0" style="width: {img.width}px;">
							<MediaImage
								filename={img.file}
								alt={img.alt}
								caption={img.caption}
								displayWidth={img.width}
								sizes="{img.width}px"
								class="w-full h-auto border border-border-subtle"
							/>
							{#if img.caption}
								<figcaption class="text-xs text-dim text-center">
									<InlineMarkup text={img.caption} />
								</figcaption>
							{/if}
						</figure>
					{/each}
				</div>
			</td>
		</tr>
	{/if}
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
