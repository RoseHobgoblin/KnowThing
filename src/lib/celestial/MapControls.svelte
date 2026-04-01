<script lang="ts">
	import type { ScaleMode, LabelMode, TrailMode, CenterTarget } from './map-settings.js'
	import Select from '$lib/components/ui/Select.svelte'
	import Checkbox from '$lib/components/ui/Checkbox.svelte'

	let {
		scale = $bindable('compressed'),
		labels = $bindable('major'),
		trails = $bindable('off'),
		centerOn = $bindable('system'),
		followSelection = $bindable(false),
	}: {
		scale: ScaleMode
		labels: LabelMode
		trails: TrailMode
		centerOn: CenterTarget
		followSelection: boolean
	} = $props()

	const scaleItems = [
		{ value: 'realistic', label: 'Realistic' },
		{ value: 'compressed', label: 'Compressed' },
		{ value: 'logarithmic', label: 'Logarithmic' },
	]

	const labelItems = [
		{ value: 'off', label: 'Off' },
		{ value: 'hovered', label: 'Hovered' },
		{ value: 'major', label: 'Major only' },
		{ value: 'all', label: 'All' },
	]

	const trailItems = [
		{ value: 'off', label: 'Off' },
		{ value: 'short', label: 'Short' },
		{ value: 'full', label: 'Full orbit' },
	]

	const centerItems = [
		{ value: 'system', label: 'System center' },
		{ value: 'star', label: 'Primary star' },
		{ value: 'selection', label: 'Selection' },
	]
</script>

<div class="flex flex-wrap items-center gap-3 px-3 py-2 bg-raised border border-border-subtle text-xs">
	<Select label="Scale" type="single" bind:value={scale} items={scaleItems} size="sm" />
	<Select label="Labels" type="single" bind:value={labels} items={labelItems} size="sm" />
	<Select label="Trails" type="single" bind:value={trails} items={trailItems} size="sm" />
	<Select label="Center" type="single" bind:value={centerOn} items={centerItems} size="sm" />
	<Checkbox bind:value={followSelection} label="Follow" />
</div>
