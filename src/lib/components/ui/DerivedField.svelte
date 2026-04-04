<script lang="ts">
	import QuestionIcon from 'phosphor-svelte/lib/Question'
	import Tooltip from './Tooltip.svelte'

	let {
		label,
		value,
		hint,
		tag,
	}: {
		label: string
		value: string | null
		hint?: string
		tag?: string
	} = $props()
</script>

<div>
	<div class="flex items-center gap-1 mb-1">
		<span class="text-xs font-medium text-secondary">{label}</span>
		{#if tag}
			<span class="text-faint text-[10px]">({tag})</span>
		{/if}
		{#if hint}
			<Tooltip content={hint} side="top">
				<span class="text-faint transition-colors cursor-help hover:text-secondary"><QuestionIcon size={12} weight="bold" /></span>
			</Tooltip>
		{/if}
	</div>
	<p class="text-sm text-dim italic">{value ?? '—'}</p>
</div>
