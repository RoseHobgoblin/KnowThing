<script lang="ts">
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut'
	let { url, display }: { url: string, display: string | null } = $props()
</script>

<a href={url} class="know-external-link text-link underline decoration-transparent hover:decoration-current transition-colors" rel="noopener noreferrer" target="_blank">
	{display || url}<span class="inline-flex align-super ml-0.5"><ArrowSquareOut size={10} /></span>
</a>
