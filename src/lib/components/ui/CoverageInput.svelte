<script lang="ts">
	import { useId } from 'bits-ui'

	let {
		value = $bindable<number | null>(null), label, hint, domain,
		disabled = false, disabledReason,
	}: {
		value?: number | null
		label: string
		hint: string
		domain: string
		disabled?: boolean
		disabledReason?: string
	} = $props()

	const id = useId('coverage')
	let specifying = $state(false)
	let transientPercent = $state<number | null>(null)
	const visible = $derived(value != null || specifying)
	const percent = $derived(transientPercent ?? (value == null ? 50 : value * 100))

	function normalizedPercent(raw: string): number {
		const parsed = Number(raw)
		return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0
	}

	function preview(event: Event): void {
		transientPercent = normalizedPercent((event.currentTarget as HTMLInputElement).value)
	}

	function commit(event: Event): void {
		const next = normalizedPercent((event.currentTarget as HTMLInputElement).value)
		value = next / 100
		transientPercent = null
		specifying = false
	}

	function handleNumberKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter') return
		commit(event)
		;(event.currentTarget as HTMLInputElement).blur()
	}

	function clear(): void {
		value = null
		transientPercent = null
		specifying = false
	}
</script>

<div class={disabled ? 'space-y-1 opacity-50' : 'space-y-1'}>
	<div class="flex min-h-5 items-center justify-between gap-2">
		<label for={`${id}-range`} class="text-xs font-medium text-body">{label}</label>
		{#if !visible}
			<button
				type="button"
				class="text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed"
				disabled={disabled}
				onclick={() => specifying = true}
			>
				Specify
			</button>
		{:else}
			<button type="button" class="text-xs text-secondary hover:text-body" disabled={disabled} onclick={clear}>Clear</button>
		{/if}
	</div>
	{#if visible}
		<div class="grid grid-cols-[1fr_5.25rem] items-center gap-2">
			<input
				id={`${id}-range`}
				type="range"
				min="0"
				max="100"
				step="1"
				value={percent}
				disabled={disabled}
				aria-label={`${label}, percentage of ${domain}`}
				oninput={preview}
				onchange={commit}
			/>
			<div class="relative">
				<input
					type="number"
					min="0"
					max="100"
					step="0.1"
					value={percent}
					disabled={disabled}
					aria-label={`${label}, exact percentage of ${domain}`}
					class="w-full bg-page py-2 pr-6 pl-2 text-sm text-body outline-none focus:ring-2 focus:ring-accent"
					oninput={preview}
					onblur={commit}
					onkeydown={handleNumberKeydown}
				/>
				<span class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-secondary">%</span>
			</div>
		</div>
	{:else}
		<p class="bg-page px-3 py-2 text-sm text-secondary">Not specified</p>
	{/if}
	<p class="text-xs text-secondary">{disabled && disabledReason ? disabledReason : hint}</p>
</div>
