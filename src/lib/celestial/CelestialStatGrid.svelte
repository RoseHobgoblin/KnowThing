<script lang="ts">
	import type { BodyModel, StarModel } from 'tungolcraft'
	import { celestialStatTiles } from './projections.js'

	let { model }: { model: BodyModel | StarModel } = $props()

	// A projection of the SAME model the infobox reads — rendered as an at-a-glance
	// grid instead of an exhaustive vertical list.
	const tiles = $derived(celestialStatTiles(model))
</script>

{#if tiles.length > 0}
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
		{#each tiles as tile (tile.label)}
			<div class="bg-raised px-3 py-2">
				<div class="text-xs uppercase tracking-wider text-secondary">{tile.label}</div>
				<div class="text-body font-medium tabular-nums">{tile.value}</div>
				{#if tile.sub}
					<div class="text-xs text-dim">{tile.sub}</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
