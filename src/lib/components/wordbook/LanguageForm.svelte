<script lang="ts">
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Label from '$lib/components/ui/Label.svelte'

	let {
		initial = {},
		existingLanguages = [],
		onsubmit,
		submitLabel = 'Save',
	}: {
		initial?: {
			name?: string
			slug?: string
			nativeName?: string
			script?: string
			family?: string
			color?: string
			description?: string
			pageSlug?: string
			parentLanguageId?: number | null
			languageType?: string
		}
		existingLanguages: Array<{ id: number, name: string }>
		onsubmit: (data: Record<string, unknown>) => Promise<void>
		submitLabel?: string
	} = $props()

	const isEditing = !!initial.name

	let name = $state(initial.name || '')
	let slug = $state(initial.slug || '')
	let nativeName = $state(initial.nativeName || '')
	let script = $state(initial.script || 'Latin')
	let family = $state(initial.family || '')
	let color = $state(initial.color || 'var(--color-accent)')
	let description = $state(initial.description || '')
	let pageSlug = $state(initial.pageSlug || '')
	let parentLanguageId = $state<number | null>(initial.parentLanguageId ?? null)
	let languageType = $state(initial.languageType || 'language')
	let submitting = $state(false)
	let error = $state('')

	// String wrapper for Select component (which works with string values)
	let parentLanguageIdStr = $derived(parentLanguageId === null ? '' : String(parentLanguageId))

	function setParentLanguageId(v: string) {
		parentLanguageId = v === '' ? null : Number(v)
	}

	const parentLanguageItems = $derived([
		{ value: '', label: 'None (root language)' },
		...existingLanguages.map(lang => ({ value: String(lang.id), label: lang.name })),
	])

	const languageTypeItems = [
		{ value: 'language', label: 'Language' },
		{ value: 'proto', label: 'Proto / Reconstructed' },
		{ value: 'historical', label: 'Historical' },
	]

	// Auto-generate slug from name (only when creating)
	function updateSlug() {
		if (isEditing) return
		if (!slug || slug === slugify(name.slice(0, -1))) {
			slug = slugify(name)
		}
	}

	function slugify(s: string): string {
		return s.toLowerCase().normalize('NFC').replaceAll(/[^\p{L}\p{N}]+/gu, '-').replaceAll(/^-|-$/g, '')
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		if (!name.trim()) { error = 'Name is required'; return }
		if (!isEditing && !slug.trim()) { error = 'Slug is required'; return }

		error = ''
		submitting = true
		try {
			await onsubmit({
				name: name.trim(),
				slug: slug.trim(),
				nativeName: nativeName.trim() || null,
				script: script.trim() || 'Latin',
				family: family.trim() || null,
				color: color || 'var(--color-accent)',
				description: description.trim() || null,
				pageSlug: pageSlug.trim() || null,
				parentLanguageId: parentLanguageId || null,
				languageType,
			})
		} catch (error_: any) {
			error = error_.message
		} finally {
			submitting = false
		}
	}

	const textareaClass = 'flex w-full min-w-0 px-3 py-2 rounded-md text-sm text-body bg-surface border border-border-strong outline-none transition-colors placeholder:text-faint hover:border-border focus:ring-2 focus:ring-accent focus:border-accent-border disabled:pointer-events-none disabled:opacity-50'
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	{#if error}
		<div class="p-3 bg-error-bg border border-error-border text-error rounded-lg text-sm">{error}</div>
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label="Name" bind:value={name} oninput={updateSlug} required placeholder="Oncheran" />
		{#if !isEditing}
			<Input label="Slug" bind:value={slug} required placeholder="oncheran" />
		{/if}
		<Input label="Native Name" bind:value={nativeName} placeholder="Ontsserako" />
		<Select
			label="Parent Language"
			type="single"
			value={parentLanguageIdStr}
			onValueChange={setParentLanguageId}
			items={parentLanguageItems}
			placeholder="None (root language)"
		/>
		<Select
			label="Type"
			type="single"
			bind:value={languageType}
			items={languageTypeItems}
			placeholder="Language"
		/>
		<div>
			<Label>
				Family
				{#if languageType === 'proto'}
					<span class="text-error">*</span>
				{:else}
					<span class="text-xs text-faint">(inherits from parent)</span>
				{/if}
			</Label>
			<Input
				bind:value={family}
				required={languageType === 'proto'}
				placeholder={languageType === 'proto' ? 'e.g. Mirish' : 'Leave blank to inherit'}
			/>
		</div>
		<Input label="Script" bind:value={script} placeholder="Latin" />
		<div>
			<Label>Accent Color</Label>
			<div class="flex gap-2 items-center mt-1">
				<input id="color" type="color" bind:value={color} class="size-10 rounded-sm border border-border-strong cursor-pointer" />
				<Input bind:value={color} placeholder="#d97706" />
			</div>
		</div>
	</div>

	<Input label="Wiki Article" bind:value={pageSlug} placeholder="oncheran_language" />

	<div>
		<Label for="desc">Description</Label>
		<textarea id="desc" bind:value={description} rows={3} class={textareaClass} placeholder="A brief description of this language..."></textarea>
	</div>

	<div class="pt-2">
		<button type="submit" disabled={submitting} class="
			px-6 py-2.5 bg-accent text-surface rounded-lg font-medium transition-colors
			hover:bg-accent-hover disabled:opacity-50
		">
			{submitting ? 'Saving...' : submitLabel}
		</button>
	</div>
</form>
