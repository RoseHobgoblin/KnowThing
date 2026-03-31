<script lang="ts">
	import { untrack } from 'svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Label from '$lib/components/ui/Label.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import { urlSlugify } from '$lib/utils/slugify.js'

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
	const initialSnapshot = $state.snapshot(untrack(() => initial))
	const initialValues = {
		name: initialSnapshot.name || '',
		slug: initialSnapshot.slug || '',
		nativeName: initialSnapshot.nativeName || '',
		script: initialSnapshot.script || 'Latin',
		family: initialSnapshot.family || '',
		color: initialSnapshot.color || 'var(--color-accent)',
		description: initialSnapshot.description || '',
		pageSlug: initialSnapshot.pageSlug || '',
		parentLanguageId: initialSnapshot.parentLanguageId ?? null,
		languageType: initialSnapshot.languageType || 'language',
	}

	const isEditing = !!initialValues.name

	let name = $state(initialValues.name)
	let slug = $state(initialValues.slug)
	let nativeName = $state(initialValues.nativeName)
	let script = $state(initialValues.script)
	let family = $state(initialValues.family)
	let color = $state(initialValues.color)
	let description = $state(initialValues.description)
	let pageSlug = $state(initialValues.pageSlug)
	let parentLanguageId = $state<number | null>(initialValues.parentLanguageId)
	let languageType = $state(initialValues.languageType)
	let submitting = $state(false)
	let error = $state('')

	const currentSnapshot = $derived(JSON.stringify({
		name,
		slug,
		nativeName,
		script,
		family,
		color,
		description,
		pageSlug,
		parentLanguageId,
		languageType,
	}))
	const savedSnapshot = JSON.stringify(initialValues)
	const isDirty = $derived(currentSnapshot !== savedSnapshot)

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

	const slugify = urlSlugify

	function updateSlug() {
		if (isEditing) return
		if (!slug || slug === slugify(name.slice(0, -1))) {
			slug = slugify(name)
		}
	}

	function resetForm() {
		name = initialValues.name
		slug = initialValues.slug
		nativeName = initialValues.nativeName
		script = initialValues.script
		family = initialValues.family
		color = initialValues.color
		description = initialValues.description
		pageSlug = initialValues.pageSlug
		parentLanguageId = initialValues.parentLanguageId
		languageType = initialValues.languageType
		error = ''
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		if (!name.trim()) {
			error = 'Name is required'
			return
		}
		if (!isEditing && !slug.trim()) {
			error = 'Slug is required'
			return
		}

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
			error = error_.message || 'Failed to save language'
		} finally {
			submitting = false
		}
	}

	const textareaClass = 'flex w-full min-w-0 px-3 py-2 text-sm text-body bg-surface border border-border-strong outline-none transition-colors placeholder:text-faint hover:border-border focus:ring-2 focus:ring-accent focus:border-accent-border disabled:pointer-events-none disabled:opacity-50'
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<UnsavedChangesGuard when={isDirty && !submitting} />

	{#if error}
		<FormNotice title="Language changes were not saved" message={error} />
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label="Name" bind:value={name} oninput={updateSlug} required placeholder="Oncheran" error={!name.trim() && error ? 'Name is required' : ''} />
		{#if !isEditing}
			<Input label="Slug" bind:value={slug} required placeholder="oncheran" error={!slug.trim() && error ? 'Slug is required' : ''} />
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
				<input id="color" type="color" bind:value={color} class="size-10 border border-border-strong cursor-pointer" />
				<Input bind:value={color} placeholder="#d97706" />
			</div>
		</div>
	</div>

	<Input label="Wiki Article" bind:value={pageSlug} placeholder="oncheran_language" />

	<div>
		<Label for="desc">Description</Label>
		<textarea id="desc" bind:value={description} rows={3} class={textareaClass} placeholder="A brief description of this language..."></textarea>
	</div>

	<StickyActionBar
		dirty={isDirty}
		saving={submitting}
		error={error}
		saveType="submit"
		ondiscard={resetForm}
		saveLabel={submitLabel}
	/>
</form>
