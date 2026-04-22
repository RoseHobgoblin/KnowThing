<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArg, positionalArgs } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()

	const positional = positionalArgs(args)
	const text = positional[0] || namedArg(args, 'text') || ''
	const author = namedArg(args, 'author') || positional[1]
	const source = namedArg(args, 'source') || positional[2]
</script>

<blockquote class="know-quote border-l-4 border-border-strong pl-4 my-4 italic text-secondary">
	<p>{text}</p>
	{#if author}
		<footer class="text-sm text-dim mt-1 not-italic">
			— {author}{#if source}, <cite>{source}</cite>{/if}
		</footer>
	{/if}
</blockquote>
