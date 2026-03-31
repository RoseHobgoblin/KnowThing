<script lang="ts">
	let {
		tone = 'error',
		title = '',
		message = '',
		messages = [],
	}: {
		tone?: 'error' | 'warning' | 'info' | 'success'
		title?: string
		message?: string
		messages?: string[]
	} = $props()

	const toneClass = $derived(
		tone === 'error'
			? 'border-error-border bg-error-bg text-error-text'
			: tone === 'warning'
				? 'border-warning/40 bg-warning/10 text-secondary'
				: tone === 'success'
					? 'border-success-border bg-success-bg text-success'
					: 'border-accent-border bg-accent-subtle text-accent-text',
	)
</script>

<div class={`border px-4 py-3 text-sm ${toneClass}`}>
	{#if title}
		<div class="mb-1 font-medium">{title}</div>
	{/if}
	{#if messages.length > 0}
		<ul class="list-disc pl-5 space-y-1">
			{#each messages as item}
				<li>{item}</li>
			{/each}
		</ul>
	{:else}
		<div>{message}</div>
	{/if}
</div>
