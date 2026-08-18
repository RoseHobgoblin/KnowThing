<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import RootMapView from '$lib/rodder/RootMap.svelte'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const slug = $derived(positionalArg(args, 0)?.trim() || '')
	const data = $derived(slug ? ctx.rootMaps?.[slug] : null)
</script>

{#if data}
	<div class="my-4 h-[clamp(20rem,60vh,40rem)]">
		<RootMapView rootName={data.rootName} stars={data.stars} bodies={data.bodies} apparentSky={data.apparentSky} />
	</div>
{:else}
	<span class="text-secondary">[root map: {slug || '?'}]</span>
{/if}
