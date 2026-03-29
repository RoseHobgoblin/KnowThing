<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import { getKnowContext } from '../context.js'
	import { get } from 'svelte/store'

	let { content }: { content: WikiNode[] } = $props()

	const ctx = getKnowContext()

	// Register this footnote and get its index
	const footnotes = get(ctx.footnotes)
	const index = footnotes.length + 1
	ctx.footnotes.update(function_ => [...function_, { index, content }])
</script>

<sup class="wiki-ref">
	<a href="#cite-note-{index}" class="text-link text-xs">[{index}]</a>
</sup>
