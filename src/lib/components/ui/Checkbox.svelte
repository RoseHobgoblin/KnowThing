<script lang="ts">
	import { cn } from '$lib/utils'
	import type { Snippet } from 'svelte'
	import { Checkbox as BitsCheckbox, useId } from 'bits-ui'

	let {
		id,
		value = $bindable<boolean | undefined>(),
		onclick,
		disabled = false,
		readonly = false,
		error = false,
		label,
		labelClass,
		class: className,
		children,
	}: {
		id?: string
		value?: boolean | undefined
		onclick?: (newValue: boolean | undefined) => void
		disabled?: boolean
		readonly?: boolean
		error?: boolean
		label?: string
		labelClass?: string
		class?: string
		children?: Snippet
	} = $props()

	id ??= useId('checkbox')
</script>

<div class="flex items-start gap-2.5">
	<BitsCheckbox.Root
		{id}
		{disabled}
		{readonly}
		bind:checked={() => value === true, (v) => {
			value = v
			onclick?.(v)
		}}
		class={cn(
			'flex shrink-0 items-center justify-center size-4 border transition-colors mt-0.5',
			value
				? 'bg-accent border-accent text-surface'
				: (error ? 'border-error bg-transparent' : 'border-border-strong bg-surface'),
			disabled && 'cursor-not-allowed opacity-50',
			readonly ? 'cursor-default' : 'cursor-pointer hover:border-accent',
			className,
		)}
	>
		{#if value === true}
			<svg class="size-3" fill="currentColor" viewBox="0 0 20 20">
				<path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
			</svg>
		{:else if value === undefined}
			<svg class="size-3" fill="currentColor" viewBox="0 0 20 20">
				<path d="M4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
			</svg>
		{/if}
	</BitsCheckbox.Root>

	{#if label}
		<label
			for={id}
			class={cn('flex flex-col', !disabled && !readonly && 'cursor-pointer')}
		>
			<span class={cn('text-sm text-secondary', labelClass)}>{label}</span>
			{#if children}
				<span class="text-xs text-secondary font-normal">
					{@render children()}
				</span>
			{/if}
		</label>
	{/if}
</div>
