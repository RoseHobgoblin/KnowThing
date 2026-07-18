<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '$lib/templates/args.js'
	import { getKnowContext } from '$lib/renderer/context.js'

	interface GraphemeRow {
		id: number
		grapheme: string
		romanization: string | null
		environment: string | null
		notes: string | null
		sortOrder: number
		phonemes: { ipa: string, type: string }[]
	}

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const slug = $derived(positionalArg(args, 0)?.trim() ?? '')
	const key = $derived(`orthography:${slug}`)
	const rows = $derived((ctx.structuredCollections?.[key] ?? null) as GraphemeRow[] | null)

	const showRomanization = $derived((rows ?? []).some(r => r.romanization?.trim()))
	const showEnvironment = $derived((rows ?? []).some(r => r.environment?.trim()))

	/** Assign footnote indices only to rows with notes, preserving row order. */
	const footnotes = $derived(
		(rows ?? [])
			.filter(r => r.notes?.trim())
			.map((r, index) => ({ id: r.id, index: index + 1, grapheme: r.grapheme, text: r.notes!.trim() })),
	)
	const footnoteById = $derived(new Map(footnotes.map(f => [f.id, f.index])))

	function ipaFor(row: GraphemeRow): string {
		if (row.phonemes.length === 0) return '—'
		return `/${row.phonemes.map(p => p.ipa).join('')}/`
	}
</script>

{#if !slug}
	<span class="text-secondary">[orthography: missing language slug]</span>
{:else if !rows}
	<span class="text-secondary">[orthography: no data for "{slug}"]</span>
{:else if rows.length === 0}
	<span class="text-secondary">[orthography: no graphemes for "{slug}"]</span>
{:else}
	<figure class="my-4 orthography-table">
		<table class="know-table know-table-divided text-sm">
			<thead>
				<tr>
					<th class="text-heading font-medium text-center">Script</th>
					{#if showRomanization}
						<th class="text-heading font-medium text-center">Romanization</th>
					{/if}
					<th class="text-heading font-medium text-center">IPA</th>
					{#if showEnvironment}
						<th class="text-heading font-medium text-left">Environment</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr>
						<td class="font-serif text-base text-center">
							{row.grapheme}
						</td>
						{#if showRomanization}
							<td class="font-serif text-center text-secondary">
								{row.romanization ?? ''}
							</td>
						{/if}
						<td
							class="font-serif text-center {row.phonemes.length === 0 ? 'text-dim' : ''}"
							title={row.phonemes.length === 0 ? 'silent / punctuation' : undefined}
						>
							{ipaFor(row)}
							{#if footnoteById.has(row.id)}<sup class="text-dim text-xs ml-0.5">{footnoteById.get(row.id)}</sup>{/if}
						</td>
						{#if showEnvironment}
							<td class="text-secondary">
								{row.environment ?? ''}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
		{#if footnotes.length > 0}
			<figcaption class="know-table-notes text-xs max-w-prose mx-auto">
				<ol class="list-none pl-0 space-y-0.5">
					{#each footnotes as function_ (function_.id)}
						<li>
							<sup>{function_.index}</sup>
							<span class="font-serif">{function_.grapheme}</span>
							<span class="mx-1">·</span>
							<span>{function_.text}</span>
						</li>
					{/each}
				</ol>
			</figcaption>
		{/if}
	</figure>
{/if}
