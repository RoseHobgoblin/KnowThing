<script lang="ts">
	import { cn } from '$lib/utils.js'
	import type { LabelMode, TrailMode, VisibilityMode } from './map-settings.js'

	let {
		labels = $bindable('major'),
		skyLabels = $bindable('off'),
		trails = $bindable('off'),
		visibility = $bindable('enhanced'),
		follow = $bindable(false),
		canFollowSelection = false,
	}: {
		labels: LabelMode
		skyLabels: LabelMode
		trails: TrailMode
		visibility: VisibilityMode
		follow: boolean
		canFollowSelection?: boolean
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

	const visibilityItems: SegmentItem<VisibilityMode>[] = [
		{ value: 'physical', label: 'Physical', title: 'Literal relative sizes with no visibility marker or minimum pick target' },
		{ value: 'enhanced', label: 'Enhanced', title: 'Physical bodies with subtle markers and usable pick targets while they are tiny' },
		{ value: 'markers', label: 'Markers', title: 'Prominent symbols for dense systems; subpixel meshes are omitted' },
	]
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border-subtle bg-page px-3 py-1.5 text-xs text-secondary select-none">
	<!-- Visibility -->
	<div class="flex items-center gap-1">
		<span class="tracking-wider text-secondary uppercase">Visibility</span>
		<div class="flex">
			{#each visibilityItems as item (item.value)}
				<button
					type="button"
					class={cn(
						'px-1.5 py-0.5 transition-colors',
						visibility === item.value ? 'bg-accent-subtle font-medium text-accent' : 'hover:bg-raised',
					)}
					title={item.title}
					aria-pressed={visibility === item.value}
					onclick={() => visibility = item.value}
				>{item.label}</button>
			{/each}
		</div>
	</div>

	<!-- Local object labels -->
	<div class="flex items-center gap-1">
		<span class="tracking-wider text-secondary uppercase">Object labels</span>
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

	<!-- Authored apparent-sky labels -->
	<div class="flex items-center gap-1">
		<span class="tracking-wider text-secondary uppercase">Sky labels</span>
		<div class="flex">
			{#each labelItems as item (item.value)}
				<button
					type="button"
					class={cn(
						'px-1.5 py-0.5 transition-colors',
						skyLabels === item.value ? 'bg-accent-subtle font-medium text-accent' : 'hover:bg-raised',
					)}
					aria-pressed={skyLabels === item.value}
					onclick={() => skyLabels = item.value}
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
		disabled={!canFollowSelection}
		class={cn(
			'px-1.5 py-0.5 transition-colors',
			follow && canFollowSelection ? 'bg-accent-subtle font-medium text-accent' : 'hover:bg-raised',
			!canFollowSelection && 'cursor-not-allowed opacity-40',
		)}
		title={canFollowSelection ? 'Center on selected body' : 'Select a local body first'}
		onclick={() => follow = !follow}
	>Follow</button>
</div>
