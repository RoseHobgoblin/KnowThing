<script lang="ts">
	import type { ScaleMode, LabelMode, TrailMode } from './map-settings.js'

	let {
		scale = $bindable('log'),
		labels = $bindable('major'),
		trails = $bindable('off'),
		follow = $bindable(false),
		hasSelection = false,
	}: {
		scale: ScaleMode
		labels: LabelMode
		trails: TrailMode
		follow: boolean
		hasSelection?: boolean
	} = $props()

	type SegmentItem<T extends string> = { value: T, label: string, title?: string }

	const scaleItems: SegmentItem<ScaleMode>[] = [
		{ value: 'log', label: 'Log', title: 'Logarithmic scale (default)' },
		{ value: 'proportional', label: 'Linear', title: 'True proportional distances' },
		{ value: 'compact', label: 'Compact', title: 'Compressed power-law scale' },
		{ value: 'inner', label: 'Inner', title: 'Inner system only' },
	]

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

<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5 bg-page border-b border-border-subtle text-xs text-secondary select-none">
	<!-- Scale -->
	<div class="flex items-center gap-1">
		<span class="text-faint uppercase tracking-wider">Scale</span>
		<div class="flex border border-border-subtle">
			{#each scaleItems as item (item.value)}
				<button
					type="button"
					title={item.title}
					class="px-1.5 py-0.5 transition-colors {scale === item.value ? 'bg-accent-subtle text-accent font-medium' : 'hover:bg-raised'}"
					onclick={() => scale = item.value}
				>{item.label}</button>
			{/each}
		</div>
	</div>

	<!-- Labels -->
	<div class="flex items-center gap-1">
		<span class="text-faint uppercase tracking-wider">Labels</span>
		<div class="flex border border-border-subtle">
			{#each labelItems as item (item.value)}
				<button
					type="button"
					class="px-1.5 py-0.5 transition-colors {labels === item.value ? 'bg-accent-subtle text-accent font-medium' : 'hover:bg-raised'}"
					onclick={() => labels = item.value}
				>{item.label}</button>
			{/each}
		</div>
	</div>

	<!-- Trails -->
	<div class="flex items-center gap-1">
		<span class="text-faint uppercase tracking-wider">Trails</span>
		<div class="flex border border-border-subtle">
			{#each trailItems as item (item.value)}
				<button
					type="button"
					class="px-1.5 py-0.5 transition-colors {trails === item.value ? 'bg-accent-subtle text-accent font-medium' : 'hover:bg-raised'}"
					onclick={() => trails = item.value}
				>{item.label}</button>
			{/each}
		</div>
	</div>

	<!-- Follow -->
	<button
		type="button"
		disabled={!hasSelection}
		class="px-1.5 py-0.5 border border-border-subtle transition-colors
			{follow && hasSelection ? 'bg-accent-subtle text-accent font-medium' : 'hover:bg-raised'}
			{!hasSelection ? 'opacity-40 cursor-not-allowed' : ''}"
		title={hasSelection ? 'Center on selected body' : 'Select a body first'}
		onclick={() => follow = !follow}
	>Follow</button>
</div>
