<script lang="ts">
	import { Select, type WithoutChildren, useId } from 'bits-ui'
	import { cn, getZodValidationError } from '$lib/utils'
	import Label from './Label.svelte'
	import type { ZodType } from 'zod'
	import CaretDown from 'phosphor-svelte/lib/CaretDown'
	import CaretUp from 'phosphor-svelte/lib/CaretUp'
	import Check from 'phosphor-svelte/lib/Check'

	type Props = WithoutChildren<Select.RootProps> & {
		id?: string
		placeholder?: string
		items: { value: string, label: string, disabled?: boolean }[]
		contentProps?: WithoutChildren<Select.ContentProps>
		class?: string
		label?: string
		labelClass?: string
		containerClass?: string
		required?: boolean
		validate?: ZodType
		validateImmediately?: boolean
		size?: 'sm' | 'md'
		/** When true, the bound value is coerced to/from number */
		numeric?: boolean
	}

	let {
		id,
		value = $bindable(),
		items,
		placeholder = 'Select...',
		contentProps,
		class: className,
		label,
		labelClass,
		containerClass,
		required = false,
		validate,
		validateImmediately = false,
		size = 'md',
		numeric = false,
		...rest
	}: Props = $props()

	id ??= useId('select')

	let open = $state(false)
	let hasInteracted = $state(false)

	$effect(() => {
		if (validateImmediately) hasInteracted = true
	})

	// Numeric coercion: internal string value syncs with external number value
	let internalValue = $state(numeric ? String(value ?? '') : value)

	$effect(() => {
		if (numeric) {
			internalValue = value != null ? String(value) : ''
		} else {
			internalValue = value
		}
	})

	function onValueChange(newValue: string) {
		if (numeric) {
			const num = Number(newValue)
			value = Number.isNaN(num) ? null : num
		} else {
			value = newValue
		}
	}

	const type = $derived(rest.type)
	const errorText = $derived(getZodValidationError(validate, value))
	const isErrorState = $derived(!!errorText && hasInteracted)

	export function getIsValidInput() {
		return !errorText
	}

	const triggerSize = { sm: 'h-8 text-xs py-1.5 px-2.5', md: 'h-10 text-sm py-2 px-3' } as const
	const itemSize = { sm: 'h-8 text-xs py-1.5 px-2.5', md: 'h-9 text-sm py-2 px-3' } as const

	const selectedLabels = $derived.by(() => {
		const compareValue = numeric ? String(value ?? '') : value
		if (type === 'single') {
			const found = items.find(item => item.value === compareValue)?.label
			if (found) return [found]
		} else {
			const labels = items.filter(item => compareValue?.includes(item.value)).map(item => item.label)
			if (labels.length > 1 && labels.reduce((a, l) => a + l.length, 0) > 40) return [`${labels.length} selected`]
			return labels
		}
		return []
	})
</script>

<div class={cn('relative', label ? 'space-y-1' : '', containerClass)}>
	{#if label}
		<Label for={id} class={labelClass}>
			{label}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</Label>
	{/if}

	<div class="relative">
		<Select.Root
			value={internalValue as never}
			onValueChange={(v) => { hasInteracted = true; onValueChange(v) }}
			bind:open
			{...rest}
		>
			<Select.Trigger
				{id}
				class={cn(
					'inline-flex items-center gap-2 text-body font-medium w-full cursor-pointer select-none appearance-none transition-colors border border-border-strong bg-surface',
					'hover:not-data-disabled:border-border',
					'data-disabled:opacity-50 data-disabled:cursor-not-allowed',
					triggerSize[size],
					open && 'ring-2 ring-accent border-accent-border',
					isErrorState && 'ring-1 ring-error-border border-error-border',
					className,
				)}
			>
				{#if selectedLabels.length}
					{#each selectedLabels as selectedLabel, index (index)}
						<span class="truncate">{selectedLabel}{index < selectedLabels.length - 1 ? ', ' : ''}</span>
					{/each}
				{:else}
					<span class="text-faint">{placeholder}</span>
				{/if}
				<span class={cn('ml-auto text-secondary transition-transform duration-200', open && 'rotate-180')}><CaretDown size={12} weight="bold" /></span>
			</Select.Trigger>
			<Select.Portal>
				<Select.Content
					{...contentProps}
					class="
						z-[9999] max-h-64 w-(--bits-select-anchor-width) min-w-(--bits-select-anchor-width)
						select-none bg-surface border border-border shadow-lg outline-none overflow-hidden
						data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
						data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
					"
				>
					<Select.ScrollUpButton class="flex w-full items-center justify-center text-secondary py-1"><CaretUp size={12} weight="bold" /></Select.ScrollUpButton>
					<Select.Viewport class="overflow-hidden">
						{#each items as { value: itemValue, label: itemLabel, disabled } (itemValue)}
							<Select.Item
								value={itemValue}
								label={itemLabel}
								{disabled}
								class={cn(
									'flex items-center gap-2 w-full select-none cursor-pointer text-body outline-none transition-colors',
									'data-highlighted:bg-raised data-highlighted:text-heading',
									'data-disabled:opacity-50 data-disabled:cursor-not-allowed',
									itemSize[size],
								)}
							>
								{#snippet children({ selected })}
									{#if type === 'multiple'}
										<span class={cn(selected ? 'text-accent' : 'text-transparent')}><Check size={14} weight="bold" /></span>
									{/if}
									{itemLabel}
								{/snippet}
							</Select.Item>
						{/each}
					</Select.Viewport>
					<Select.ScrollDownButton class="flex w-full items-center justify-center text-secondary py-1"><CaretDown size={12} weight="bold" /></Select.ScrollDownButton>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	</div>

	{#if validate}
		<div
			class="text-error text-xs transition-opacity absolute -bottom-4 left-0 pointer-events-none"
			class:opacity-0={!isErrorState}
		>
			{isErrorState ? errorText : ''}
		</div>
	{/if}
</div>
