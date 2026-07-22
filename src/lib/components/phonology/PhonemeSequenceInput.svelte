<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Plus from 'phosphor-svelte/lib/PlusIcon'
	import X from 'phosphor-svelte/lib/XIcon'
	import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVerticalIcon'
	import { createSortable } from '$lib/utils/sortable.svelte'

	interface PhonemeOption {
		id: number
		ipa: string
		type: string
	}

	let {
		value = $bindable<number[]>([]),
		options,
	}: {
		value?: number[]
		options: PhonemeOption[]
	} = $props()

	const optionById = $derived(new Map(options.map(o => [o.id, o])))
	const selectItems = $derived([
		{ value: '__add__', label: 'Select a phoneme…', disabled: true },
		...options.map(o => ({ value: String(o.id), label: `/${o.ipa}/ — ${o.type}` })),
	])

	let pendingId = $state<string>('__add__')

	function addPhoneme() {
		const id = Number(pendingId)
		if (!Number.isFinite(id) || id <= 0) return
		value = [...value, id]
		pendingId = '__add__'
	}

	function removeAt(index: number) {
		value = value.filter((_, index_) => index_ !== index)
	}

	const sortable = createSortable({
		cancel: 'button',
		onReorder(from, to) {
			const next = [...value]
			const [moved] = next.splice(from, 1)
			next.splice(to, 0, moved)
			value = next
		},
	})
</script>

<div class="phoneme-sequence-input">
	<div class="flex flex-wrap items-center gap-1.5 min-h-10 p-2 bg-raised">
		{#if value.length === 0}
			<span class="text-dim text-xs italic">Silent — no phonemes. Add one below, or leave empty for punctuation / silent letters.</span>
		{:else}
			{#each value as pid, index (pid + ':' + index)}
				{@const p = optionById.get(pid)}
				<div
					class="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-sm text-sm cursor-grab"
					class:opacity-50={sortable.dragIndex === index}
					class:ring-1={sortable.overIndex === index}
					class:ring-accent={sortable.overIndex === index}
					use:sortable.item={index}
					title={p ? `${p.type}` : 'unknown phoneme'}
					role="listitem"
				>
					<DotsSixVertical size={12} class="text-secondary" />
					<span class="font-serif">/{p?.ipa ?? '?'}/</span>
					<button type="button" class="text-secondary hover:text-error" onclick={() => removeAt(index)} aria-label="Remove phoneme">
						<X size={12} weight="bold" />
					</button>
				</div>
			{/each}
		{/if}
	</div>

	<div class="flex items-center gap-2 mt-2">
		<div class="flex-1">
			<Select type="single" items={selectItems} bind:value={pendingId} placeholder="Pick phoneme to append…" size="sm" />
		</div>
		<Button size="sm" variant="secondary" onclick={addPhoneme} disabled={pendingId === '__add__'}>
			<Plus size={14} weight="bold" /> Add
		</Button>
	</div>
</div>
