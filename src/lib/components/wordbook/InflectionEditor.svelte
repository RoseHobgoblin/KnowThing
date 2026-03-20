<script lang="ts">
	import { invalidateAll } from '$app/navigation'

	let {
		entryId,
		inflection,
		availableClasses = [],
	}: {
		entryId: number
		inflection: {
			dimensions: Array<{ id: number, name: string, values: string[], sortOrder: number }>
			forms: Record<string, string>
			overrides: Record<string, string>
			className: string | null
			stem: string | null
			hasInflection: boolean
		}
		availableClasses: Array<{ id: number, name: string, partOfSpeech: string }>
	} = $props()

	let editing = $state(false)
	let selectedClassId = $state<number | null>(null)
	let stem = $state('')
	let overrides = $state<Record<string, string>>({})
	let saving = $state(false)
	let error = $state('')

	function startEditing() {
		// Initialize from current inflection state
		selectedClassId = null
		stem = inflection.stem || ''
		overrides = { ...(inflection.overrides || {}) }

		// Try to find the current class ID from the name
		if (inflection.className) {
			const match = availableClasses.find(c => c.name === inflection.className)
			if (match) selectedClassId = match.id
		}

		editing = true
	}

	async function save() {
		saving = true
		error = ''

		try {
			const res = await fetch(`/api/wordbook/${entryId}/inflection`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					classId: selectedClassId || null,
					stem: stem.trim() || null,
					overrides: Object.fromEntries(
						Object.entries(overrides).filter(([_, v]) => v.trim()),
					),
				}),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to save')
			}

			editing = false
			invalidateAll()
		} catch (error_: any) {
			error = error_.message
		} finally {
			saving = false
		}
	}

	async function removeInflection() {
		if (!confirm('Remove inflection data for this entry?')) return
		saving = true
		// Delete by setting everything to null/empty
		await fetch(`/api/wordbook/${entryId}/inflection`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ classId: null, stem: null, overrides: {} }),
		})
		editing = false
		saving = false
		invalidateAll()
	}

	// Generate cell keys from dimensions for override inputs
	function getCellKeys(dimensions: typeof inflection.dimensions): string[] {
		if (dimensions.length === 0) return []
		const sorted = [...dimensions].sort((a, b) => a.sortOrder - b.sortOrder)

		function cartesian(index: number): string[] {
			if (index >= sorted.length) return ['']
			const rest = cartesian(index + 1)
			const result: string[] = []
			for (const value of sorted[index].values) {
				for (const suffix of rest) {
					result.push(suffix ? `${value}.${suffix}` : value)
				}
			}
			return result
		}
		return cartesian(0)
	}

	const cellKeys = $derived(getCellKeys(inflection.dimensions))

	const inputClass = 'px-2 py-1 border border-border-strong rounded-md text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-accent'
</script>

{#if editing}
	<div class="mt-4 p-4 bg-raised rounded-lg border border-border space-y-3">
		<div class="flex items-center justify-between">
			<h4 class="text-xs font-medium uppercase tracking-wide text-dim">Set up inflection</h4>
			<div class="flex gap-2">
				{#if inflection.hasInflection}
					<button onclick={removeInflection} class="text-xs text-error hover:underline">Remove</button>
				{/if}
				<button onclick={() => editing = false} class="text-xs text-faint hover:text-secondary">Cancel</button>
			</div>
		</div>

		{#if error}
			<div class="p-2 bg-red-50 border border-red-200 text-error rounded-md text-xs">{error}</div>
		{/if}

		<div class="flex gap-3 flex-wrap">
			<!-- Paradigm class -->
			<div class="flex-1 min-w-[200px]">
				<label class="block text-xs font-medium text-secondary mb-1">Paradigm Class</label>
				{#if availableClasses.length > 0}
					<select bind:value={selectedClassId} class="w-full {inputClass}">
						<option value={null}>Manual (no class)</option>
						{#each availableClasses as cls}
							<option value={cls.id}>{cls.name} ({cls.partOfSpeech})</option>
						{/each}
					</select>
				{:else}
					<p class="text-xs text-faint">No paradigm classes defined for this language. <a href="/wordbook/{inflection.dimensions.length > 0 ? '' : 'contribute/language'}" class="text-link hover:underline">Set up inflection dimensions first.</a></p>
				{/if}
			</div>

			<!-- Stem -->
			<div class="flex-1 min-w-[150px]">
				<label class="block text-xs font-medium text-secondary mb-1">Stem</label>
				<input type="text" bind:value={stem} class="w-full {inputClass}" placeholder="e.g. tsida" />
			</div>
		</div>

		<!-- Override grid -->
		{#if cellKeys.length > 0}
			<div>
				<label class="block text-xs font-medium text-secondary mb-1">
					Overrides <span class="text-faint font-normal">— leave blank to use paradigm rules</span>
				</label>
				<div class="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
					{#each cellKeys as key}
						{@const generated = inflection.forms[key] || ''}
						<div class="flex items-center gap-2">
							<span class="text-xs text-faint w-32 truncate" title={key}>{key.replaceAll('.', ' · ')}</span>
							<input
								type="text"
								value={overrides[key] || ''}
								oninput={(e) => {
									const value = (e.target as HTMLInputElement).value
									if (value.trim()) {
										overrides[key] = value
									} else {
										const { [key]: _, ...rest } = overrides
										overrides = rest
									}
								}}
								placeholder={generated || '—'}
								class="flex-1 {inputClass} text-xs {overrides[key] ? 'border-accent bg-accent-subtle' : ''}"
							/>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<button
			onclick={save}
			disabled={saving}
			class="
				px-4 py-1.5 bg-accent text-surface text-sm rounded-md font-medium transition-colors
				hover:bg-accent-hover
				disabled:opacity-50
			"
		>
			{saving ? 'Saving...' : 'Save Inflection'}
		</button>
	</div>
{:else if !inflection.hasInflection}
	<button onclick={startEditing} class="mt-3 text-sm text-link hover:text-link-hover hover:underline">
		+ Set up inflection
	</button>
{:else}
	<button onclick={startEditing} class="mt-1 text-xs text-faint hover:text-link hover:underline">
		Edit inflection
	</button>
{/if}
