<script lang="ts">
	import LockSimple from 'phosphor-svelte/lib/LockSimple'
	import LockSimpleOpen from 'phosphor-svelte/lib/LockSimpleOpen'
	import Input from './Input.svelte'

	let {
		label,
		derivedValue,
		value = $bindable<number | string | null>(null),
		locked = $bindable(false),
		hint,
		type = 'text',
		step,
		placeholder,
	}: {
		label: string
		derivedValue: string | null
		value?: number | string | null
		locked?: boolean
		hint?: string
		type?: 'text' | 'number'
		step?: string
		placeholder?: string
	} = $props()

	function toggleLock() {
		if (locked) {
			locked = false
			value = null
		} else {
			locked = true
			if (type === 'number' && derivedValue != null) {
				const parsed = parseFloat(derivedValue)
				value = isNaN(parsed) ? derivedValue : parsed
			} else {
				value = derivedValue
			}
		}
	}
</script>

<div class="relative">
	{#if locked}
		<Input {label} bind:value {type} {step} {placeholder} {hint} />
	{:else}
		<Input {label} value={derivedValue ?? '—'} readonly {hint} />
	{/if}
	<button
		type="button"
		class="absolute top-0.5 text-faint transition-colors hover:text-secondary"
		style="right: -16px;"
		onclick={toggleLock}
		title={locked ? 'Unlock: revert to auto-derived value' : 'Lock: override with a custom value'}
	>
		{#if locked}
			<LockSimple size={11} weight="bold" />
		{:else}
			<LockSimpleOpen size={11} weight="bold" />
		{/if}
	</button>
</div>
