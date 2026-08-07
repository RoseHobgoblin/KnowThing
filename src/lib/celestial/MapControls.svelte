<script lang="ts">
	import { cn } from '$lib/utils.js'
	import type { LabelMode, TrailMode } from './map-settings.js'

	let {
		labels = $bindable('major'),
		trails = $bindable('off'),
		follow = $bindable(false),
		hasSelection = false,
	}: {
		labels: LabelMode
		trails: TrailMode
		follow: boolean
		hasSelection?: boolean
	} = $props()

	type SegmentItem<T extends string> = { value: T, label: string, title?: string }

	const labelItems: SegmentItem<LabelMode>[] = [
		{ value: 'off', label: 'Off' },
		{ value: 'hovered', label: 'Hover' },
		{ value: 'major', label: 'Major' },
		{ value: 'all', label: 'All' },
	]

	const trailItems: SegmentItem<TrailMode>[] = [
		{ value: 'off', label: 'Off' },
		{ value: 'short', label: 'Short' },
		{ value: 'full', label: 'Full' },
	]
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border-subtle bg-page px-3 py-1.5 text-xs text-secondary select-none">
	<!-- Labels -->
	<div class="flex items-center gap-1">
		<span class="tracking-wider text-secondary uppercase">Labels</span>
		<div class="flex">
			{#each labelItems as item (item.value)}
				<button
					type="button"
					class={cn(
						'px-1.5 py-0.5 transition-colors',
						labels === item.value ? 'bg-accent-subtle font-medium text-accent' : 'hover:bg-raised',
					)}
					onclick={() => labels = item.value}
				>{item.label}</button>
			{/each}
		</div>
	</div>

	<!-- Trails -->
	<div class="flex items-center gap-1">
		<span class="tracking-wider text-secondary uppercase">Trails</span>
		<div class="flex">
			{#each trailItems as item (item.value)}
				<button
					type="button"
					class={cn(
						'px-1.5 py-0.5 transition-colors',
						trails === item.value ? 'bg-accent-subtle font-medium text-accent' : 'hover:bg-raised',
					)}
					onclick={() => trails = item.value}
				>{item.label}</button>
			{/each}
		</div>
	</div>

	<!-- Follow -->
	<button
		type="button"
		disabled={!hasSelection}
		class={cn(
			'px-1.5 py-0.5 transition-colors',
			follow && hasSelection ? 'bg-accent-subtle font-medium text-accent' : 'hover:bg-raised',
			!hasSelection && 'cursor-not-allowed opacity-40',
		)}
		title={hasSelection ? 'Center on selected body' : 'Select a body first'}
		onclick={() => follow = !follow}
	>Follow</button>
</div>
