<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()
	const description = positionalArg(args, 0) || ''
</script>

<svelte:head>
	<meta name="description" content={description} />
</svelte:head>
