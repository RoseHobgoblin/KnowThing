<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args, visible }: { args: TemplateArg[], visible: boolean } = $props()
	const id = positionalArg(args, 0) || ''
</script>

<span {id}>{visible ? id : ''}</span>
