<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()
	const lang = $derived(positionalArg(args, 0) || '')
	const text = $derived(positionalArg(args, 1) || '')
</script>

<span {lang}>{text}</span>
