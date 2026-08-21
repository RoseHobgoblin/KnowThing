<script lang="ts">
	import { getKnowContext, type MediaRenderProps } from './context.js'

	let props: MediaRenderProps = $props()
	const ctx = getKnowContext()
	const MediaRenderer = ctx.mediaRenderer
	const fallbackUrl = $derived(`/api/media/${encodeURIComponent(props.filename)}`)
</script>

{#if MediaRenderer}
	<MediaRenderer {...props} />
{:else}
	<img src={fallbackUrl} alt={props.alt ?? ''} loading={props.loading ?? 'lazy'} class={props.class ?? ''} />
{/if}
