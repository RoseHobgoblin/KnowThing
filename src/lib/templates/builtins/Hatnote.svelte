<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArgs } from '../args.js'

	let { args, variant }: { args: TemplateArg[], variant: 'main' | 'see-also' | 'for' | 'about' } = $props()

	const positional = $derived(positionalArgs(args))

	function pageHref(page: string): string {
		return `/know/${encodeURIComponent(page.trim())}`
	}
</script>

<div class="know-hatnote italic text-sm text-dim mb-4 pl-4">
	{#if variant === 'main' || variant === 'see-also'}
		{variant === 'main' ? 'Main article' : 'See also'}:
		{#each positional as page, index (index)}
			{#if index > 0}, {/if}
			<a href={pageHref(page)} class="text-link hover:underline">{page.trim()}</a>
		{/each}
	{:else if variant === 'for'}
		For {positional[0] || ''}, see
		<a href={pageHref(positional[1] || '')} class="text-link hover:underline">{(positional[1] || '').trim()}</a>.
	{:else if variant === 'about'}
		This article is about {positional[0] || ''}.
		{#if positional[1]}
			For {positional[1]}, see
			<a href={pageHref(positional[2] || positional[1])} class="text-link hover:underline">{(positional[2] || positional[1]).trim()}</a>.
		{/if}
	{/if}
</div>
