<script lang="ts">
	import { tick, type Snippet } from 'svelte'
	import type { SvelteHTMLElements } from 'svelte/elements'
	import { cn } from '$lib/utils'
	import { useId } from 'bits-ui'
	import Label from './Label.svelte'
	import Check from 'phosphor-svelte/lib/Check'
	import Copy from 'phosphor-svelte/lib/Copy'
	import X from 'phosphor-svelte/lib/X'
	import Eye from 'phosphor-svelte/lib/Eye'
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash'
	import QuestionIcon from 'phosphor-svelte/lib/Question'
	import Tooltip from './Tooltip.svelte'

	type Props = SvelteHTMLElements['input'] & {
		label?: string
		labelClass?: string
		labelExtra?: Snippet
		containerClass?: string
		clearable?: boolean
		copyable?: boolean
		onclear?: () => void
		onsubmit?: () => void
		onchange?: (newValue: string, oldValue: string) => void
		charset?: string
		error?: string
		hint?: string
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
		clearable = false,
		copyable = false,
		onclear,
		charset,
		error: externalError,
		hint,
		labelExtra,
		...props
	}: Props = $props()

	id ??= useId('input')

	let oldValue = $state(value)
	let passwordVisible = $state(false)
	let inputRef = $state<HTMLInputElement>()
	let justCopied = $state(false)
	let copyTimer: ReturnType<typeof setTimeout> | undefined

	const displayType = $derived(type === 'password' && passwordVisible ? 'text' : type)
	const isErrorState = $derived(!!externalError)

	$effect(() => {
		if (oldValue !== value) {
			onchange?.(value as string, oldValue as string)
			oldValue = value
		}
	})

	export function focus() {
		if (!readonly) inputRef?.focus()
	}

	function onBlur(event_: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) {
		onblur?.(event_)
	}

	function filterCharset(inputValue: string): string {
		if (!charset) return inputValue
		const regex = new RegExp(`[^${charset}]`, 'g')
		return inputValue.replace(regex, '')
	}

	async function onInput(event_: Event & { currentTarget: EventTarget & HTMLInputElement }) {
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
			clearTimeout(copyTimer)
			copyTimer = setTimeout(() => justCopied = false, 1500)
		} catch { /* clipboard can fail */ }
	}
</script>

<div class={cn('relative', label ? 'space-y-1' : '', externalError && 'pb-5', containerClass)}>
	{#if label}
		<div class="flex items-center gap-1">
			<Label for={id} class={labelClass}>
				{label}
				{#if required}
					<span class="text-error">*</span>
				{/if}
			</Label>
			{#if labelExtra}
				{@render labelExtra()}
			{/if}
			{#if hint}
				<Tooltip content={hint} side="top">
					<span class="text-secondary transition-colors cursor-help hover:text-body"><QuestionIcon size={12} weight="bold" /></span>
				</Tooltip>
			{/if}
		</div>
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
				'flex w-full min-w-0 px-3 py-2 text-sm text-body bg-page outline-none transition-colors',
				'placeholder:text-dim',
				!readonly && 'focus:ring-2 focus:ring-accent',
				'aria-invalid:ring-1 aria-invalid:ring-error-border',
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
				<button type="button" class="text-secondary transition-colors hover:text-body" onclick={onCopy} aria-label="Copy to clipboard">
					{#if justCopied}
						<Check size={14} weight="bold" />
					{:else}
						<Copy size={14} />
					{/if}
				</button>
			{/if}
			{#if clearable && value}
				<button type="button" class="text-secondary transition-colors hover:text-body" onclick={onClear} aria-label="Clear">
					<X size={14} weight="bold" />
				</button>
			{/if}
			{#if type === 'password'}
				<button type="button" class="text-secondary transition-colors hover:text-body" onclick={() => passwordVisible = !passwordVisible} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>
					{#if passwordVisible}
						<Eye size={14} />
					{:else}
						<EyeSlash size={14} />
					{/if}
				</button>
			{/if}
		</div>
	</div>

	{#if externalError}
		<div class="text-error text-xs absolute bottom-0 left-0 pointer-events-none">
			{externalError}
		</div>
	{/if}
</div>
