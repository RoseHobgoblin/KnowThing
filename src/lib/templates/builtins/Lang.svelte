<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()
	const lang = positionalArg(args, 0) || ''
	const text = positionalArg(args, 1) || ''
</script>

<span {lang}>{text}</span>
