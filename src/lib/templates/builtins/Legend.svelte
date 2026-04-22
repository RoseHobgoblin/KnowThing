<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()
	const color = positionalArg(args, 0) || '#ccc'
	const label = positionalArg(args, 1) || ''
</script>

<span class="inline-flex items-center gap-1.5 text-sm">
	<span class="inline-block size-3" style="background-color: {color}"></span>
	{label}
</span>
