<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import WikiInternalLink from '$lib/renderer/nodes/WikiInternalLink.svelte'

	let { args }: { args: TemplateArg[] } = $props()
	const country = $derived((positionalArg(args, 0) || '').trim())
</script>

<WikiInternalLink target={country} display={null} />
