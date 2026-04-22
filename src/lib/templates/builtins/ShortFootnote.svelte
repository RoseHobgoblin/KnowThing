<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArgAny, positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import { get } from 'svelte/store'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const author = $derived(positionalArg(args, 0) || '')
	const year = $derived(positionalArg(args, 1) || '')
	const page = $derived(namedArgAny(args, 'p', 'page') || '')
	const display = $derived(`${author} ${year}${page ? `, p. ${page}` : ''}`.trim())

	const index = get(ctx.footnotes).length + 1
	ctx.footnotes.update(list => [...list, { index, content: [{ type: 'text', text: display }] }])
</script>

<sup class="wiki-ref" title={display}>
	<a href="#cite-note-{index}" class="text-link text-xs">[{author} {year}]</a>
</sup>
