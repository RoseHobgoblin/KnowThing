<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Plus from 'phosphor-svelte/lib/PlusIcon'
	import X from 'phosphor-svelte/lib/XIcon'
	import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVerticalIcon'

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
	let dragging = $state<number | null>(null)

	function addPhoneme() {
		const id = Number(pendingId)
		if (!Number.isFinite(id) || id <= 0) return
		value = [...value, id]
		pendingId = '__add__'
	}

	function removeAt(index: number) {
		value = value.filter((_, index_) => index_ !== index)
	}

	function onDragStart(index: number, event: DragEvent) {
		dragging = index
		event.dataTransfer?.setData('text/plain', String(index))
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault()
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
	}

	function onDrop(index: number, event: DragEvent) {
		event.preventDefault()
		const from = dragging
		dragging = null
		if (from == null || from === index) return
		const next = [...value]
		const [moved] = next.splice(from, 1)
		next.splice(index, 0, moved)
		value = next
	}

	function onDragEnd() {
		dragging = null
	}
</script>

<div class="phoneme-sequence-input">
	<div class="flex flex-wrap items-center gap-1.5 min-h-10 p-2 border border-border-subtle bg-raised">
		{#if value.length === 0}
			<span class="text-dim text-xs italic">Silent — no phonemes. Add one below, or leave empty for punctuation / silent letters.</span>
		{:else}
			{#each value as pid, index (pid + ':' + index)}
				{@const p = optionById.get(pid)}
				<div
					class="inline-flex items-center gap-1 px-2 py-1 bg-muted border border-border-subtle rounded-sm text-sm cursor-grab"
					class:opacity-50={dragging === index}
					draggable="true"
					ondragstart={e => onDragStart(index, e)}
					ondragover={onDragOver}
					ondrop={e => onDrop(index, e)}
					ondragend={onDragEnd}
					title={p ? `${p.type}` : 'unknown phoneme'}
					role="listitem"
				>
					<DotsSixVertical size={12} class="text-faint" />
					<span class="font-serif">/{p?.ipa ?? '?'}/</span>
					<button type="button" class="text-faint hover:text-error" onclick={() => removeAt(index)} aria-label="Remove phoneme">
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
