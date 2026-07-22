<script lang="ts">
	import { untrack } from 'svelte'
	import { useId, DropdownMenu } from 'bits-ui'
	import { cn } from '$lib/utils'
	import Label from './Label.svelte'
	import Tooltip from './Tooltip.svelte'
	import QuestionIcon from 'phosphor-svelte/lib/Question'
	import CaretDown from 'phosphor-svelte/lib/CaretDown'
	import Check from 'phosphor-svelte/lib/Check'

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
	const storageUnit = $derived(units.find(u => u.factor === 1) ?? units[0])

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

	// Track the value we last wrote ourselves. Only re-derive the display unit
	// when the stored value changes from *outside* (preset apply, discard) — the
	// user's own typing and unit choice are never second-guessed.
	let lastValue = untrack(() => value)

	$effect(() => {
		const storedValue = value
		untrack(() => {
			if (storedValue === lastValue) return
			lastValue = storedValue
			const index = storedValue == null ? unitIndex : pickUnit(storedValue)
			unitIndex = index
			text = format(storedValue, index)
		})
	})

	function onInput() {
		if (text.trim() === '') {
			value = null
			lastValue = null
			return
		}
		const typed = Number(text)
		if (Number.isFinite(typed)) {
			value = typed * units[unitIndex].factor
			lastValue = value
		}
	}

	function selectUnit(index: number) {
		unitIndex = index
		text = format(value, index)
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
			class="
				flex w-full min-w-0 px-3 py-2 pr-24 text-sm text-body bg-page outline-none transition-colors
				placeholder:text-dim
				focus:ring-2 focus:ring-accent
				aria-invalid:ring-1 aria-invalid:ring-error-border
			"
			oninput={onInput}
		/>
		<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
			{#if units.length > 1}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						title="Change unit — the value converts; storage stays in {storageUnit.label}"
						class="
							flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold bg-accent-subtle text-accent border border-accent-border/60 cursor-pointer transition-colors
							hover:bg-accent-subtle/60
						"
					>
						{units[unitIndex].label}
						<CaretDown size={10} weight="bold" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content
							align="end"
							sideOffset={4}
							class="
								z-9999 min-w-24 bg-surface shadow-lg outline-none overflow-hidden
								data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
								data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
							"
						>
							{#each units as unit, index (unit.label)}
								<DropdownMenu.Item
									onSelect={() => selectUnit(index)}
									class={cn(
										'flex items-center justify-between gap-3 px-2.5 py-1.5 text-xs cursor-pointer select-none outline-none transition-colors',
										'data-highlighted:bg-raised data-highlighted:text-heading',
										index === unitIndex ? 'text-heading font-medium' : 'text-body',
									)}
								>
									<span>{unit.label}</span>
									{#if unit.factor === 1}
										<span class="text-[0.65rem] text-secondary">storage</span>
									{:else if index === unitIndex}
										<Check size={12} weight="bold" class="text-accent" />
									{/if}
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
				{#if units[unitIndex].factor !== storageUnit.factor}
					<span class="text-xs text-secondary" title="Stored in {storageUnit.label}">{storageUnit.label}</span>
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
