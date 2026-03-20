<script lang="ts">
	import type { TableRow } from '$lib/parser/types.js'
	import WikiNodeComponent from '../WikiNode.svelte'

	let { attrs, rows }: { attrs: string, rows: TableRow[] } = $props()

	// Extract class from attrs string if present
	function extractClass(a: string): string {
		const m = a.match(/class\s*=\s*"([^"]+)"/)
		return m ? m[1] : ''
	}

	const tableClass = $derived(extractClass(attrs))
</script>

<table class="know-table border-collapse my-4 {tableClass}">
	<tbody>
		{#each rows as row}
			<tr>
				{#each row.cells as cell}
					{#if cell.isHeader}
						<th class="know-th bg-raised border border-border-strong px-3 py-1.5 text-left font-bold text-sm">
							{#each cell.children as child}<WikiNodeComponent node={child} />{/each}
						</th>
					{:else}
						<td class="know-td border border-border-strong px-3 py-1.5 text-sm">
							{#each cell.children as child}<WikiNodeComponent node={child} />{/each}
						</td>
					{/if}
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
