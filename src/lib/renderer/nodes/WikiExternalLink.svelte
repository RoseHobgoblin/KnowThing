<script lang="ts">
	let { url, display }: { url: string; display: string | null } = $props();
</script>

<a href={url} class="know-external-link text-amber-700 hover:underline" rel="noopener noreferrer" target="_blank">
	{display || url}<span class="text-xs align-super ml-0.5">↗</span>
</a>
