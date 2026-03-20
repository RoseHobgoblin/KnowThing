<script lang="ts">
	type Dimension = {
		id: number;
		name: string;
		values: string[];
		sortOrder: number;
	};

	let { dimensions, forms, overrides = {}, className, stem, hasInflection }: {
		dimensions: Dimension[];
		forms: Record<string, string>;
		overrides?: Record<string, string>;
		className: string | null;
		stem: string | null;
		hasInflection: boolean;
	} = $props();

	// Sort dimensions by sortOrder: first = rows, second = columns
	const sorted = $derived([...dimensions].sort((a, b) => a.sortOrder - b.sortOrder));
	const rowDim = $derived(sorted[0]);
	const colDim = $derived(sorted[1]);
	const extraDims = $derived(sorted.slice(2));

	// For 1-dimension, render a simple list
	// For 2-dimensions, render a row×column table
	// For 3+, group by extra dimensions first

	function getCellKey(...values: string[]): string {
		return values.join('.');
	}

	function getForm(key: string): string {
		return forms[key] || '';
	}

	function isOverride(key: string): boolean {
		return key in (overrides || {});
	}
</script>

{#if hasInflection && dimensions.length > 0 && Object.keys(forms).length > 0}
	<div class="mt-4">
		<div class="flex items-baseline gap-2 mb-2">
			<h3 class="text-xs font-medium uppercase tracking-wide text-stone-400">Inflection</h3>
			{#if className}
				<span class="text-xs text-stone-400">({className})</span>
			{/if}
			{#if stem}
				<span class="text-xs text-stone-400 font-mono">stem: {stem}</span>
			{/if}
		</div>

		{#if dimensions.length === 1 && rowDim}
			<!-- Single dimension: simple list -->
			<div class="border border-stone-200 rounded-lg overflow-hidden text-sm">
				{#each rowDim.values as val}
					{@const key = val}
					{@const form = getForm(key)}
					{#if form}
						<div class="flex border-b border-stone-100 last:border-0">
							<div class="w-32 px-3 py-1.5 bg-stone-50 text-stone-600 font-medium text-xs">{val}</div>
							<div class="flex-1 px-3 py-1.5 font-mono {isOverride(key) ? 'text-amber-700 italic' : 'text-stone-800'}">{form}</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else if dimensions.length >= 2 && rowDim && colDim}
			<!-- Two+ dimensions: table -->
			{#if extraDims.length === 0}
				<div class="border border-stone-200 rounded-lg overflow-hidden overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-stone-50">
								<th class="px-3 py-1.5 text-left text-xs text-stone-500 font-medium border-r border-stone-200"></th>
								{#each colDim.values as col}
									<th class="px-3 py-1.5 text-center text-xs text-stone-600 font-medium">{col}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each rowDim.values as row}
								<tr class="border-t border-stone-100">
									<td class="px-3 py-1.5 bg-stone-50 text-xs text-stone-600 font-medium border-r border-stone-200">{row}</td>
									{#each colDim.values as col}
										{@const key = getCellKey(row, col)}
										{@const form = getForm(key)}
										<td class="px-3 py-1.5 text-center font-mono text-sm {isOverride(key) ? 'text-amber-700 italic bg-amber-50/30' : 'text-stone-800'}">
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
				{@const extraKeys = extraDims.reduce((acc: string[][], dim) => {
					if (acc.length === 0) return dim.values.map(v => [v]);
					const result: string[][] = [];
					for (const prev of acc) {
						for (const v of dim.values) {
							result.push([...prev, v]);
						}
					}
					return result;
				}, [])}

				{#each extraKeys as extraVals}
					<div class="mb-4">
						<div class="text-xs text-stone-500 font-medium mb-1">
							{extraDims.map((d, i) => `${d.name}: ${extraVals[i]}`).join(', ')}
						</div>
						<div class="border border-stone-200 rounded-lg overflow-hidden overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="bg-stone-50">
										<th class="px-3 py-1.5 text-left text-xs text-stone-500 font-medium border-r border-stone-200"></th>
										{#each colDim.values as col}
											<th class="px-3 py-1.5 text-center text-xs text-stone-600 font-medium">{col}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each rowDim.values as row}
										<tr class="border-t border-stone-100">
											<td class="px-3 py-1.5 bg-stone-50 text-xs text-stone-600 font-medium border-r border-stone-200">{row}</td>
											{#each colDim.values as col}
												{@const key = getCellKey(row, col, ...extraVals)}
												{@const form = getForm(key)}
												<td class="px-3 py-1.5 text-center font-mono text-sm {isOverride(key) ? 'text-amber-700 italic bg-amber-50/30' : 'text-stone-800'}">
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
