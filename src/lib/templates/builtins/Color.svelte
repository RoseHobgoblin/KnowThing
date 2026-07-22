<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()
	const color = $derived(positionalArg(args, 0) || 'inherit')
	const text = $derived(positionalArg(args, 1) || '')
</script>

<span style="color: {color}">{text}</span>
