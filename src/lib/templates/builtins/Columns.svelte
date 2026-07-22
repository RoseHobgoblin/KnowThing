<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArgs } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()
	const cols = $derived(positionalArgs(args).join('\n'))
</script>

<div class="columns-2 gap-6">{cols}</div>
