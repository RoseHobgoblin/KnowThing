<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArg } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()

	const title = namedArg(args, 'title')
	const rows = args.filter(a => a.name && a.name.toLowerCase().trim() !== 'title')
</script>

<div class="know-sidebar float-right ml-4 mb-4 bg-page text-sm w-56 p-3">
	{#if title}
		<div class="font-bold text-center mb-2 pb-1 border-b border-border">{title}</div>
	{/if}
	{#each rows as row, i (row.name ?? i)}
		<div class="py-0.5 text-secondary">
			<span class="text-dim">{row.name}:</span> {row.value}
		</div>
	{/each}
</div>
