<script lang="ts">
	import Input from './Input.svelte'

	let {
		label,
		value,
		hint,
		tag,
	}: {
		label: string
		value: string | null
		hint?: string
		tag?: string
	} = $props()

	const displayLabel = $derived(tag ? `${label} (${tag})` : label)
</script>

<Input label={displayLabel} value={value ?? '—'} readonly {hint} />
