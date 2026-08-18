<script lang="ts">
	import type { BodyModel, StarModel } from 'tungolcraft'
	import { rodderFactSections } from './projections.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let { model }: { model: BodyModel | StarModel } = $props()

	// A projection of the same model the infobox reads — laid out as full-width
	// grouped sections instead of a cramped floating table.
	const sections = $derived(rodderFactSections(model))
</script>

{#if sections.length > 0}
	<div class="gap-3 columns-1 md:columns-2 [&>section]:mb-3 [&>section]:break-inside-avoid">
		{#each sections as section (section.title)}
			<section class="bg-surface">
				<h3 class="text-xs font-semibold uppercase tracking-wider text-secondary px-3 py-2 border-b border-border-subtle bg-raised">
					{section.title}
				</h3>
				<dl>
					{#each section.rows as row (row.label)}
						<div class="grid grid-cols-[auto_1fr] gap-3 px-3 py-1.5 text-sm border-b border-border-subtle/40 last:border-0">
							<dt class="text-secondary">{row.label}</dt>
							<dd class="text-body text-right wrap-break-word"><InlineMarkup text={row.value} /></dd>
						</div>
					{/each}
				</dl>
			</section>
		{/each}
	</div>
{/if}
