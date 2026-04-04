<script lang="ts">
	import LockSimple from 'phosphor-svelte/lib/LockSimple'
	import LockSimpleOpen from 'phosphor-svelte/lib/LockSimpleOpen'
	import Input from './Input.svelte'

	let {
		label,
		derivedValue,
		value = $bindable<number | string | null>(null),
		unlocked = $bindable(false),
		hint,
		type = 'text',
		step,
		placeholder,
	}: {
		label: string
		derivedValue: string | null
		value?: number | string | null
		unlocked?: boolean
		hint?: string
		type?: 'text' | 'number'
		step?: string
		placeholder?: string
	} = $props()

	function toggle() {
		if (unlocked) {
			unlocked = false
			value = null
		} else {
			unlocked = true
			if (type === 'number' && derivedValue != null) {
				const parsed = parseFloat(derivedValue)
				value = isNaN(parsed) ? derivedValue : parsed
			} else {
				value = derivedValue
			}
		}
	}
</script>

{#snippet lockIcon()}
	<button
		type="button"
		class="text-faint transition-colors inline-flex hover:text-secondary"
		onclick={toggle}
		title={unlocked ? 'Re-lock: revert to auto-derived value' : 'Unlock: override with a custom value'}
	>
		{#if unlocked}
			<LockSimpleOpen size={11} weight="bold" />
		{:else}
			<LockSimple size={11} weight="bold" />
		{/if}
	</button>
{/snippet}

{#if unlocked}
	<Input {label} bind:value {type} {step} {placeholder} {hint}>
		{#snippet labelExtra()}{@render lockIcon()}{/snippet}
	</Input>
{:else}
	<Input {label} value={derivedValue ?? '—'} readonly {hint}>
		{#snippet labelExtra()}{@render lockIcon()}{/snippet}
	</Input>
{/if}
