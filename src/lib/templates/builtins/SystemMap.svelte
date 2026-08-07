<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import SystemMapView from '$lib/celestial/SystemMap.svelte'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const slug = $derived(positionalArg(args, 0)?.trim() || '')
	const data = $derived(slug ? ctx.systemMaps?.[slug] : null)
</script>

{#if data}
	<div class="my-4 h-[clamp(20rem,60vh,40rem)]">
		<SystemMapView systemName={data.systemName} stars={data.stars} bodies={data.bodies} />
	</div>
{:else}
	<span class="text-secondary">[system map: {slug || '?'}]</span>
{/if}
