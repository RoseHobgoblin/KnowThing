<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()
	const country = (positionalArg(args, 0) || '').trim()
</script>

<a
	href="/know/{encodeURIComponent(country)}"
	class="text-link hover:underline"
	title="Flag of {country}"
>{country}</a>
