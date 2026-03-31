<script lang="ts">
	let {
		modeLabel,
		title,
		description,
		actions,
	}: {
		modeLabel: string
		title: string
		description: string
		actions?: import('svelte').Snippet
	} = $props()
</script>

<section class="bg-surface border border-border px-4 py-4">
	<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
		<div class="space-y-1">
			<div class="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{modeLabel}</div>
			<h2 class="text-sm font-semibold text-heading">{title}</h2>
			<p class="text-sm text-secondary max-w-2xl">{description}</p>
		</div>
		{#if actions}
			<div class="flex items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
</section>
