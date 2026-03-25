<script lang="ts">
	import {
		CONSONANT_PLACES, CONSONANT_MANNERS, VOWEL_HEIGHTS, VOWEL_BACKNESSES,
		VOICING_OPTIONS, sortByReference,
	} from '$lib/wordbook/phoneme-types.js'

	type Phoneme = {
		id: number
		ipa: string
		type: string
		place?: string | null
		manner?: string | null
		subtype?: string | null
		voicing?: string | null
		height?: string | null
		backness?: string | null
		rounded?: boolean | null
		notes?: string | null
		sortOrder: number
	}

	let { phonemes, type, showNotes = true }: {
		phonemes: Phoneme[]
		type: 'consonant' | 'vowel'
		showNotes?: boolean
	} = $props()

	// Collect footnotes from phonemes that have notes
	const footnotes = $derived(
		phonemes
			.filter(p => p.notes)
			.map((p, i) => ({ index: i + 1, ipa: p.ipa, text: p.notes! }))
	)
	const noteIndex = $derived(
		new Map(footnotes.map(f => [f.ipa, f.index]))
	)

	// ---- Consonant grid (manner × place) ----
	const consonantPlaces = $derived(
		sortByReference(
			[...new Set(phonemes.filter(p => p.place).map(p => p.place!))],
			CONSONANT_PLACES,
		)
	)

	// Build manner rows, expanding subtypes as sub-rows
	const consonantRows = $derived.by(() => {
		const manners = sortByReference(
			[...new Set(phonemes.filter(p => p.manner).map(p => p.manner!))],
			CONSONANT_MANNERS,
		)
		const rows: { manner: string; subtype: string | null; label: string }[] = []
		for (const manner of manners) {
			const subtypes = [...new Set(
				phonemes.filter(p => p.manner === manner && p.subtype).map(p => p.subtype!),
			)]
			if (subtypes.length > 0) {
				for (const sub of subtypes) {
					rows.push({ manner, subtype: sub, label: sub })
				}
			} else {
				rows.push({ manner, subtype: null, label: manner })
			}
		}
		return rows
	})

	// Build a lookup: `manner|subtype|place` → phonemes in that cell
	const consonantCells = $derived.by(() => {
		const map = new Map<string, Phoneme[]>()
		for (const p of phonemes) {
			if (!p.manner || !p.place) continue
			const key = `${p.manner}|${p.subtype ?? ''}|${p.place}`
			const arr = map.get(key) ?? []
			arr.push(p)
			map.set(key, arr)
		}
		// Sort each cell: voiceless before voiced
		const voiceOrder = new Map<string, number>(VOICING_OPTIONS.map((v, i) => [v, i]))
		for (const arr of map.values()) {
			arr.sort((a, b) => (voiceOrder.get(a.voicing ?? '') ?? 9) - (voiceOrder.get(b.voicing ?? '') ?? 9))
		}
		return map
	})

	// Track which manners have subtypes (for rowspan display)
	const mannerHasSubtypes = $derived(
		new Map(consonantRows.reduce((acc, r) => {
			acc.set(r.manner, (acc.get(r.manner) ?? 0) + 1)
			return acc
		}, new Map<string, number>()))
	)
	const mannerFirstRow = $derived(
		new Set(consonantRows.filter((r, i) =>
			i === 0 || consonantRows[i - 1].manner !== r.manner,
		).map(r => r.manner + '|' + (r.subtype ?? '')))
	)

	// ---- Vowel grid (height × backness) ----
	const vowelBacknesses = $derived(
		sortByReference(
			[...new Set(phonemes.filter(p => p.backness).map(p => p.backness!))],
			VOWEL_BACKNESSES,
		)
	)
	const vowelHeights = $derived(
		sortByReference(
			[...new Set(phonemes.filter(p => p.height).map(p => p.height!))],
			VOWEL_HEIGHTS,
		)
	)
	const vowelCells = $derived.by(() => {
		const map = new Map<string, Phoneme[]>()
		for (const p of phonemes) {
			if (!p.height || !p.backness) continue
			const key = `${p.height}|${p.backness}`
			const arr = map.get(key) ?? []
			arr.push(p)
			map.set(key, arr)
		}
		// Sort: unrounded before rounded
		for (const arr of map.values()) {
			arr.sort((a, b) => (a.rounded ? 1 : 0) - (b.rounded ? 1 : 0))
		}
		return map
	})
</script>

{#if type === 'consonant' && consonantPlaces.length > 0 && consonantRows.length > 0}
	<div class="border border-border rounded-lg overflow-hidden overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="bg-page">
					<th class="px-3 py-1.5 text-left text-xs text-dim font-medium border-r border-border" colspan="{ mannerHasSubtypes.size > 0 ? 2 : 1 }"></th>
					{#each consonantPlaces as place}
						<th class="px-3 py-1.5 text-center text-xs text-secondary font-medium capitalize">{place}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each consonantRows as row, i}
					{@const isFirst = mannerFirstRow.has(row.manner + '|' + (row.subtype ?? ''))}
					{@const span = mannerHasSubtypes.get(row.manner) ?? 1}
					<tr class="border-t border-border-subtle">
						{#if isFirst && span > 1}
							<td
								class="px-3 py-1.5 bg-page text-xs text-secondary font-medium border-r border-border-subtle capitalize"
								rowspan={span}
							>{row.manner}</td>
						{/if}
						{#if span > 1}
							<td class="px-2 py-1.5 bg-page text-xs text-dim border-r border-border capitalize">{row.label}</td>
						{:else}
							<td
								class="px-3 py-1.5 bg-page text-xs text-secondary font-medium border-r border-border capitalize"
								colspan={[...mannerHasSubtypes.values()].some(v => v > 1) ? 2 : 1}
							>{row.label}</td>
						{/if}
						{#each consonantPlaces as place}
							{@const key = `${row.manner}|${row.subtype ?? ''}|${place}`}
							{@const cellPhonemes = consonantCells.get(key) ?? []}
							<td class="px-3 py-1.5 text-center">
								{#if cellPhonemes.length > 0}
									{#each cellPhonemes as p, j}
										{#if j > 0}<span class="text-border mx-0.5"> </span>{/if}
										<span class="font-mono" title={p.voicing ?? ''}>{p.ipa}</span>
										{#if noteIndex.has(p.ipa)}
											<sup class="text-link text-[10px] ml-0.5">{noteIndex.get(p.ipa)}</sup>
										{/if}
									{/each}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if type === 'vowel' && vowelBacknesses.length > 0 && vowelHeights.length > 0}
	<div class="border border-border rounded-lg overflow-hidden overflow-x-auto">
		<table class="w-full text-sm">
			<thead>
				<tr class="bg-page">
					<th class="px-3 py-1.5 text-left text-xs text-dim font-medium border-r border-border"></th>
					{#each vowelBacknesses as backness}
						<th class="px-3 py-1.5 text-center text-xs text-secondary font-medium capitalize">{backness}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each vowelHeights as height}
					<tr class="border-t border-border-subtle">
						<td class="px-3 py-1.5 bg-page text-xs text-secondary font-medium border-r border-border capitalize">{height}</td>
						{#each vowelBacknesses as backness}
							{@const key = `${height}|${backness}`}
							{@const cellPhonemes = vowelCells.get(key) ?? []}
							<td class="px-3 py-1.5 text-center">
								{#if cellPhonemes.length > 0}
									{#each cellPhonemes as p, j}
										{#if j > 0}<span class="text-border mx-0.5"> </span>{/if}
										<span class="font-mono" title={p.rounded ? 'rounded' : 'unrounded'}>{p.ipa}</span>
										{#if noteIndex.has(p.ipa)}
											<sup class="text-link text-[10px] ml-0.5">{noteIndex.get(p.ipa)}</sup>
										{/if}
									{/each}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if showNotes && footnotes.length > 0}
	<ol class="mt-2 text-xs text-dim space-y-0.5 list-decimal list-inside">
		{#each footnotes as note}
			<li><span class="font-mono">{note.ipa}</span> — {note.text}</li>
		{/each}
	</ol>
{/if}
