<script lang="ts">
	import { untrack } from 'svelte'
	import { Select, useId } from 'bits-ui'
	import { cn } from '$lib/utils'
	import Label from './Label.svelte'
	import Tooltip from './Tooltip.svelte'
	import QuestionIcon from 'phosphor-svelte/lib/Question'
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon'
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
		disabled = false,
	}: {
		label: string
		/** The canonical stored value (always in the first unit's terms when factor = 1). */
		value: number | null
		/** Selectable display units, sorted ascending by factor; the factor-1 entry is the storage unit. */
		units: UnitOption[]
		placeholder?: string
		hint?: string
		error?: string
		disabled?: boolean
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
	let focused = $state(false)
	// This is deliberately non-reactive: it distinguishes our writes from a
	// genuine parent update without creating another effect dependency.
	let lastCommittedValue = untrack(() => value)

	// Re-sync the display when the stored value changes from outside (preset
	// apply, discard) — but never while the user is typing in the field.
	$effect(() => {
		const storedValue = value
		const isFocused = focused
		untrack(() => {
			if (isFocused || Object.is(storedValue, lastCommittedValue)) return
			const index = storedValue == null ? unitIndex : pickUnit(storedValue)
			unitIndex = index
			text = format(storedValue, index)
			lastCommittedValue = storedValue
		})
	})

	function commit(nextValue: number | null) {
		lastCommittedValue = nextValue
		value = nextValue
	}

	function onInput(event: Event & { currentTarget: HTMLInputElement }) {
		const nextText = event.currentTarget.value
		text = nextText
		if (nextText.trim() === '') {
			commit(null)
			return
		}
		const typed = Number(nextText)
		if (Number.isFinite(typed)) commit(typed * units[unitIndex].factor)
	}

	function onBlur() {
		focused = false
		// Clean up precision without automatically changing the chosen unit.
		text = format(value, unitIndex)
	}

	// Switch display unit without changing the stored value — reformats the text
	// into the newly picked unit's terms.
	function selectUnit(index: number) {
		if (index === unitIndex || !units[index]) return
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
					<span class="cursor-help text-secondary transition-colors hover:text-body"><QuestionIcon size={12} weight="bold" /></span>
				</Tooltip>
			{/if}
		</div>
	{/if}

	<div class="relative">
		<input
			{id}
			type="number"
			step="any"
			value={text}
			{placeholder}
			aria-invalid={!!error}
			{disabled}
			class="
				flex w-full min-w-0 bg-page px-3 py-2 pr-20 text-sm text-body transition-colors outline-none
				placeholder:text-dim
				focus:ring-2 focus:ring-accent
				aria-invalid:ring-1 aria-invalid:ring-error-border
			"
			onfocus={() => focused = true}
			onblur={onBlur}
			oninput={onInput}
		/>
		<div class="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5">
			{#if units.length > 1}
				<Select.Root
					type="single"
					{disabled}
					value={String(unitIndex)}
					onValueChange={v => selectUnit(Number(v))}
				>
					<Select.Trigger
						aria-label="Display unit"
						title="Change display unit — stored in {storageUnit.label}"
						class="
							inline-flex cursor-pointer items-center gap-1 border border-accent-border/60 bg-accent-subtle px-1.5 py-0.5 text-xs font-semibold text-accent
							transition-colors
							hover:bg-accent-subtle/60
							data-[state=open]:ring-2 data-[state=open]:ring-accent
						"
					>
						{units[unitIndex].label}
						<CaretDownIcon size={10} weight="bold" class="opacity-70" />
					</Select.Trigger>
					<Select.Portal>
						<Select.Content
							class="
								z-9999 max-h-64 min-w-24 overflow-hidden bg-surface shadow-lg outline-none select-none
								data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
								data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
							"
						>
							<Select.Viewport class="overflow-hidden p-0">
								{#each units as unit, index (index)}
									<Select.Item
										value={String(index)}
										label={unit.label}
										class="
											flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-body transition-colors outline-none select-none
											data-highlighted:bg-raised data-highlighted:text-heading
										"
									>
										{#snippet children({ selected })}
											<span>{unit.label}</span>
											{#if selected}
												<span class="text-accent"><Check size={12} weight="bold" /></span>
											{/if}
										{/snippet}
									</Select.Item>
								{/each}
							</Select.Viewport>
						</Select.Content>
					</Select.Portal>
				</Select.Root>
			{:else}
				<span class="text-xs text-secondary">{units[unitIndex].label}</span>
			{/if}
		</div>
	</div>

	{#if error !== undefined}
		<div class="pointer-events-none absolute bottom-0 left-0 text-xs text-error transition-opacity" class:opacity-0={!error}>
			{error}
		</div>
	{/if}
</div>
