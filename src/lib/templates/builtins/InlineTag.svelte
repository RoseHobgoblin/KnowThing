<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'

	let { args, variant }: { args: TemplateArg[], variant: 'small' | 'big' | 'sup' | 'sub' | 'nowrap' } = $props()

	const text = positionalArg(args, 0) || ''
</script>

{#if variant === 'small'}<small>{text}</small>
{:else if variant === 'big'}<big>{text}</big>
{:else if variant === 'sup'}<sup>{text}</sup>
{:else if variant === 'sub'}<sub>{text}</sub>
{:else if variant === 'nowrap'}<span class="whitespace-nowrap">{text}</span>
{/if}
