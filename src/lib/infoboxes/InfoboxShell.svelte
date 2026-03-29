<script lang="ts">
	import type { Snippet } from 'svelte'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	let {
		title = '',
		subtitle = '',
		image = '',
		imageCaption = '',
		aboveContent = '',
		belowContent = '',
		children,
	}: {
		title?: string
		subtitle?: string
		image?: string
		imageCaption?: string
		aboveContent?: string
		belowContent?: string
		children: Snippet
	} = $props()
</script>

<table class="know-infobox">
	<tbody>
		{#if title}
			<tr>
				<th colspan="2" class="infobox-title">
					<InlineMarkup text={title} />
				</th>
			</tr>
		{/if}
		{#if subtitle}
			<tr>
				<td colspan="2" class="infobox-subtitle">
					<InlineMarkup text={subtitle} />
				</td>
			</tr>
		{/if}
		{#if aboveContent}
			<tr>
				<td colspan="2" class="infobox-above">
					<InlineMarkup text={aboveContent} />
				</td>
			</tr>
		{/if}
		{#if image}
			<tr>
				<td colspan="2" class="text-center p-3 border-b border-border-subtle">
					<img
						src="/api/media/{image}?w=300"
						alt={imageCaption || image}
						class="max-w-full h-auto mx-auto"
						onerror={(e) => { const element = e.currentTarget as HTMLImageElement; element.style.display = 'none'; if (element.nextElementSibling) (element.nextElementSibling as HTMLElement).style.display = 'block' }}
					/>
					<div class="
						text-faint italic text-xs border border-dashed border-border p-6 bg-page
						hidden
					">
						[Image: {image}]
					</div>
					{#if imageCaption}
						<div class="text-xs text-dim mt-1.5"><InlineMarkup text={imageCaption} /></div>
					{/if}
				</td>
			</tr>
		{/if}
		{@render children()}
		{#if belowContent}
			<tr>
				<td colspan="2" class="infobox-below">
					<InlineMarkup text={belowContent} />
				</td>
			</tr>
		{/if}
	</tbody>
</table>
