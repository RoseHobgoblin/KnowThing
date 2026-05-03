<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	type Variant = 'small' | 'big' | 'sup' | 'sub' | 'nowrap' | 'nobold' | 'nbsp' | 'hanging-indent'

	let { args, variant }: { args: TemplateArg[], variant: Variant } = $props()

	const text = positionalArg(args, 0) || ''
</script>

{#if variant === 'small'}<small>{text}</small>
{:else if variant === 'big'}<big>{text}</big>
{:else if variant === 'sup'}<sup>{text}</sup>
{:else if variant === 'sub'}<sub>{text}</sub>
{:else if variant === 'nowrap'}<span class="whitespace-nowrap">{text}</span>
{:else if variant === 'nobold'}<span style="font-weight: normal"><InlineMarkup {text} /></span>
{:else if variant === 'nbsp'}{#if text}<InlineMarkup {text} />&nbsp;{:else}{@html '&nbsp;'}{/if}
{:else if variant === 'hanging-indent'}<div class="hanging-indent"><InlineMarkup {text} /></div>
{/if}
