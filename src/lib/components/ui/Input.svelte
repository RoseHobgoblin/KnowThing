<script lang="ts">
	import { tick } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { cn, getZodValidationError } from '$lib/utils'
	import { useId } from 'bits-ui'
	import Label from './Label.svelte'
	import type { ZodType } from 'zod'

	type Props = SvelteHTMLElements['input'] & {
		label?: string
		labelClass?: string
		containerClass?: string
		validate?: ZodType
		validateImmediately?: boolean
		clearable?: boolean
		copyable?: boolean
		onclear?: () => void
		onsubmit?: () => void
		onchange?: (newValue: string, oldValue: string) => void
		charset?: string
		error?: string
	}

	let {
		class: className,
		id,
		label,
		labelClass,
		containerClass,
		value = $bindable(),
		required = false,
		type,
		readonly = false,
		onblur,
		oninput,
		onsubmit,
		onchange,
		validate,
		validateImmediately = false,
		clearable = false,
		copyable = false,
		onclear,
		charset,
		error: externalError,
		...props
	}: Props = $props()

	id ??= useId('input')

	let hasInteracted = $state(false)
	let oldValue = $state(value)
	let passwordVisible = $state(false)
	let inputRef = $state<HTMLInputElement>()
	let justCopied = $state(false)

	$effect(() => {
		if (validateImmediately) hasInteracted = true
	})

	const displayType = $derived(type === 'password' && passwordVisible ? 'text' : type)
	const errorText = $derived(getZodValidationError(validate, value))
	const isErrorState = $derived((!!errorText && hasInteracted) || !!externalError)

	$effect(() => {
		if (oldValue !== value) {
			onchange?.(value as string, oldValue as string)
			oldValue = value
		}
	})

	export function focus() {
		if (!readonly) inputRef?.focus()
	}

	export function getIsValidInput() {
		return !errorText
	}

	function onBlur(event_: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		hasInteracted = true
		onblur?.(event_)
	}

	function filterCharset(inputValue: string): string {
		if (!charset) return inputValue
		const regex = new RegExp(`[^${charset}]`, 'g')
		return inputValue.replace(regex, '')
	}

	async function onInput(event_: Event & { currentTarget: EventTarget & HTMLInputElement }) {
		hasInteracted = true
		if (event_.target) {
			const input = event_.target as HTMLInputElement
			const cursorPosition = input.selectionStart
			let processedValue = input.value

			if (charset) processedValue = filterCharset(processedValue)

			if (input.value !== processedValue) {
				value = processedValue
				await tick()
				if (inputRef) {
					const removedChars = input.value.length - processedValue.length
					const newCursorPos = Math.max(0, (cursorPosition || 0) - removedChars)
					inputRef.selectionStart = newCursorPos
					inputRef.selectionEnd = newCursorPos
				}
			}
		}
		oninput?.(event_)
	}

	function onKeydown(event_: KeyboardEvent) {
		if (event_.key === 'Enter') onsubmit?.()
	}

	function onClear() {
		if (onclear) onclear()
		else value = ''
	}

	async function onCopy() {
		if (!value) return
		try {
			await navigator.clipboard.writeText(String(value))
			justCopied = true
			setTimeout(() => justCopied = false, 1500)
		} catch { /* clipboard can fail */ }
	}
</script>

<div class={cn('relative', label ? 'space-y-1' : '', (validate || externalError) && 'pb-5', containerClass)}>
	{#if label}
		<Label for={id} class={labelClass}>
			{label}
			{#if required}
				<span class="text-error">*</span>
			{/if}
		</Label>
	{/if}

	<div class="relative">
		<input
			bind:this={inputRef}
			bind:value
			aria-invalid={isErrorState}
			{id}
			type={displayType}
			{readonly}
			tabindex={readonly ? -1 : undefined}
			class={cn(
				'flex w-full min-w-0 px-3 py-2 text-sm text-body bg-surface border border-border-strong outline-none transition-colors',
				'placeholder:text-faint',
				!readonly && 'hover:border-border focus:ring-2 focus:ring-accent focus:border-accent-border',
				'aria-invalid:ring-1 aria-invalid:ring-error-border aria-invalid:border-error-border',
				'disabled:pointer-events-none disabled:opacity-50',
				readonly && 'bg-raised text-secondary cursor-default',
				(copyable || clearable || type === 'password') && 'pr-10',
				className,
			)}
			onblur={onBlur}
			oninput={onInput}
			onkeydown={onKeydown}
			{...props}
		/>

		<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
			{#if copyable}
				<button type="button" class="text-faint transition-colors hover:text-secondary text-xs" onclick={onCopy}>
					{justCopied ? '✓' : '⧉'}
				</button>
			{/if}
			{#if clearable && value}
				<button type="button" class="text-faint transition-colors hover:text-secondary" onclick={onClear}>×</button>
			{/if}
			{#if type === 'password'}
				<button type="button" class="text-faint transition-colors hover:text-secondary text-xs" onclick={() => passwordVisible = !passwordVisible}>
					{passwordVisible ? '◉' : '◎'}
				</button>
			{/if}
		</div>
	</div>

	{#if (validate || externalError)}
		<div
			class="text-error text-xs transition-opacity absolute bottom-0 left-0 pointer-events-none"
			class:opacity-0={!isErrorState}
		>
			{isErrorState ? (externalError || errorText) : ''}
		</div>
	{/if}
</div>
