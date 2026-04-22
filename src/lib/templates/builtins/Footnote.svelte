<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArg, positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import { get } from 'svelte/store'

	let { args, kind }: { args: TemplateArg[], kind: 'refn' | 'efn' } = $props()

	const ctx = getKnowContext()
	const text = $derived(positionalArg(args, 0) || namedArg(args, 'text') || '')

	const index = get(ctx.footnotes).length + 1
	ctx.footnotes.update(list => [...list, { index, content: [{ type: 'text', text }] }])
</script>

<sup class="wiki-ref" title={text}>
	<a href="#cite-note-{index}" class="text-link text-xs">[{kind === 'efn' ? 'n' : ''}{index}]</a>
</sup>
