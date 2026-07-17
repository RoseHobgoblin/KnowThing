<script lang="ts">
	import { untrack } from 'svelte'
	import { useId } from 'bits-ui'
	import { cn } from '$lib/utils'
	import Label from './Label.svelte'
	import Tooltip from './Tooltip.svelte'
	import QuestionIcon from 'phosphor-svelte/lib/Question'

	export interface UnitOption {
		/** Display label, e.g. 'kg', 'M☉'. */
		label: string
		/** How many storage units one display unit is worth (storage = typed × factor). */
		factor: number
	}

	let {
		label,
		value = $bindable(),
		units,
		placeholder,
		hint,
		error,
	}: {
		label: string
		/** The canonical stored value (always in the first unit's terms when factor = 1). */
		value: number | null
		/** Selectable display units, sorted ascending by factor; the factor-1 entry is the storage unit. */
		units: UnitOption[]
		placeholder?: string
		hint?: string
		error?: string
	} = $props()

	const id = useId('unit-input')
	const storageUnit = units.find(u => u.factor === 1) ?? units[0]

	/** The largest unit in which the value still reads as a sensible number. */
	function pickUnit(storedValue: number | null): number {
		if (storedValue == null || !Number.isFinite(storedValue) || storedValue === 0) return 0
		let best = 0
		for (const [index, unit] of units.entries()) {
			if (Math.abs(storedValue) / unit.factor >= 0.01) best = index
		}
		return best
	}

	function format(storedValue: number | null, unitIndex_: number): string {
		if (storedValue == null || !Number.isFinite(storedValue)) return ''
		const inUnit = storedValue / units[unitIndex_].factor
		if (inUnit !== 0 && (Math.abs(inUnit) >= 1e7 || Math.abs(inUnit) < 1e-4)) return inUnit.toExponential(4)
		return String(Number(inUnit.toPrecision(6)))
	}

	let unitIndex = $state(pickUnit(untrack(() => value)))
	let text = $state(format(untrack(() => value), untrack(() => unitIndex)))
	let focused = $state(false)

	// Re-sync the display when the stored value changes from outside (preset
	// apply, discard) — but never while the user is typing in the field.
	$effect(() => {
		const storedValue = value
		const isFocused = focused
		untrack(() => {
			if (isFocused) return
			const index = storedValue == null ? unitIndex : pickUnit(storedValue)
			unitIndex = index
			text = format(storedValue, index)
		})
	})

	function onInput() {
		if (text.trim() === '') {
			value = null
			return
		}
		const typed = Number(text)
		if (Number.isFinite(typed)) value = typed * units[unitIndex].factor
	}

	function cycleUnit() {
		unitIndex = (unitIndex + 1) % units.length
		text = format(value, unitIndex)
	}
</script>

<div class={cn('relative', label ? 'space-y-1' : '', error !== undefined && 'pb-5')}>
	{#if label}
		<div class="flex items-center gap-1">
			<Label for={id}>{label}</Label>
			{#if hint}
				<Tooltip content={hint} side="top">
					<span class="text-secondary transition-colors cursor-help hover:text-body"><QuestionIcon size={12} weight="bold" /></span>
				</Tooltip>
			{/if}
		</div>
	{/if}

	<div class="relative">
		<input
			{id}
			type="number"
			step="any"
			bind:value={text}
			{placeholder}
			aria-invalid={!!error}
			class={cn(
				'flex w-full min-w-0 px-3 py-2 pr-20 text-sm text-body bg-page outline-none transition-colors',
				'placeholder:text-dim focus:ring-2 focus:ring-accent',
				'aria-invalid:ring-1 aria-invalid:ring-error-border',
			)}
			onfocus={() => focused = true}
			onblur={() => focused = false}
			oninput={onInput}
		/>
		<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
			{#if units.length > 1}
				<Tooltip content="Change unit — the value converts, storage stays in {storageUnit.label}" side="top">
					<button
						type="button"
						onclick={cycleUnit}
						class="px-1.5 py-0.5 text-xs font-semibold bg-accent-subtle text-accent border border-accent-border/60 transition-colors hover:bg-accent-subtle/60"
					>
						{units[unitIndex].label}
					</button>
				</Tooltip>
				{#if units[unitIndex].factor !== storageUnit.factor}
					<span class="text-xs text-secondary">{storageUnit.label}</span>
				{/if}
			{:else}
				<span class="text-xs text-secondary">{units[unitIndex].label}</span>
			{/if}
		</div>
	</div>

	{#if error !== undefined}
		<div class="text-error text-xs transition-opacity absolute bottom-0 left-0 pointer-events-none" class:opacity-0={!error}>
			{error}
		</div>
	{/if}
</div>
