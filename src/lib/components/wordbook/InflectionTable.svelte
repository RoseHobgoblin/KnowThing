<script lang="ts">
	type Dimension = {
		id: number
		name: string
		values: string[]
		sortOrder: number
	}

	let { dimensions, forms, overrides = {}, className, stem, hasInflection }: {
		dimensions: Dimension[]
		forms: Record<string, string>
		overrides?: Record<string, string>
		className: string | null
		stem: string | null
		hasInflection: boolean
	} = $props()

	// Sort dimensions by sortOrder: first = rows, second = columns
	const sorted = $derived([...dimensions].sort((a, b) => a.sortOrder - b.sortOrder))
	const rowDim = $derived(sorted[0])
	const colDim = $derived(sorted[1])
	const extraDims = $derived(sorted.slice(2))

	// For 1-dimension, render a simple list
	// For 2-dimensions, render a row×column table
	// For 3+, group by extra dimensions first

	function getCellKey(...values: string[]): string {
		return values.join('.')
	}

	function getForm(key: string): string {
		return forms[key] || ''
	}

	function isOverride(key: string): boolean {
		return key in (overrides || {})
	}
</script>

{#if hasInflection && dimensions.length > 0 && Object.keys(forms).length === 0}
	<div class="mt-4 p-3 bg-warning-bg border border-warning-border text-sm text-body">
		Inflection is assigned but no forms were generated. Check that the paradigm class has rules defined, and that a stem is set.
	</div>
{:else if hasInflection && dimensions.length > 0 && Object.keys(forms).length > 0}
	<div class="mt-4">
		<div class="flex items-baseline gap-2 mb-2">
			<h3 class="text-xs font-medium uppercase tracking-wide text-secondary">Inflection</h3>
			{#if className}
				<span class="text-xs text-secondary">({className})</span>
			{/if}
			{#if stem}
				<span class="text-xs text-secondary font-mono">stem: {stem}</span>
			{/if}
		</div>

		{#if dimensions.length === 1 && rowDim}
			<!-- Single dimension: simple list -->
			<div class="overflow-hidden text-sm">
				{#each rowDim.values as value (value)}
					{@const key = value}
					{@const form = getForm(key)}
					{#if form}
						<div class="flex border-b border-border-subtle last:border-0">
							<div class="w-32 px-3 py-1.5 bg-page text-secondary font-medium text-xs">{value}</div>
							<div class="flex-1 px-3 py-1.5 font-mono {isOverride(key) ? 'text-link italic' : 'text-body'}">{form}</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else if dimensions.length >= 2 && rowDim && colDim}
			<!-- Two+ dimensions: table -->
			{#if extraDims.length === 0}
				<div class="overflow-hidden overflow-x-auto">
					<table class="know-table know-table-divided w-full text-sm">
						<thead>
							<tr>
								<th class="text-left text-xs text-dim font-medium"></th>
								{#each colDim.values as col (col)}
									<th class="text-center text-xs text-secondary font-medium">{col}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each rowDim.values as row (row)}
								<tr>
									<td class="
										text-xs text-secondary font-medium
									">{row}</td>
									{#each colDim.values as col (col)}
										{@const key = getCellKey(row, col)}
										{@const form = getForm(key)}
										<td class="text-center font-mono text-sm {isOverride(key) ? 'text-link italic bg-accent-subtle/30' : 'text-body'}">
											{form || '—'}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<!-- 3+ dimensions: group by extra dims -->
				{@const extraKeys = extraDims.reduce((accumulator: string[][], dim) => {
					if (accumulator.length === 0) return dim.values.map(v => [v])
					const result: string[][] = []
					for (const previous of accumulator) {
						for (const v of dim.values) {
							result.push([...previous, v])
						}
					}
					return result
				}, [])}

				{#each extraKeys as extraVals (extraVals.join('.'))}
					<div class="mb-4">
						<div class="text-xs text-dim font-medium mb-1">
							{extraDims.map((d, index) => `${d.name}: ${extraVals[index]}`).join(', ')}
						</div>
						<div class="overflow-hidden overflow-x-auto">
							<table class="know-table know-table-divided w-full text-sm">
								<thead>
									<tr>
										<th class="
											text-left text-xs text-dim font-medium
										"></th>
										{#each colDim.values as col (col)}
											<th class="text-center text-xs text-secondary font-medium">{col}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each rowDim.values as row (row)}
										<tr>
											<td class="
												text-xs text-secondary font-medium
											">{row}</td>
											{#each colDim.values as col (col)}
												{@const key = getCellKey(row, col, ...extraVals)}
												{@const form = getForm(key)}
												<td class="text-center font-mono text-sm {isOverride(key) ? 'text-link italic bg-accent-subtle/30' : 'text-body'}">
													{form || '—'}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/each}
			{/if}
		{/if}
	</div>
{/if}
