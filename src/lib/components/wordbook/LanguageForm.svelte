<script lang="ts">
	import { untrack } from 'svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Label from '$lib/components/ui/Label.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import { createDirtyTracker } from '$lib/utils/dirty.svelte'
	import { m } from '$lib/paraglide/messages.js'

	let {
		initial = {},
		existingLanguages = [],
		onsubmit,
		submitLabel = m.common_save(),
		recordGone = false,
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
		/** Set by the parent once the language is deleted elsewhere on the page, so the
		 * guard stops defending edits to a record that no longer exists. */
		recordGone?: boolean
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

	const dirty = createDirtyTracker(() => ({
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
	const isDirty = $derived(dirty.isDirty)

	let parentLanguageIdStr = $derived(parentLanguageId === null ? '' : String(parentLanguageId))

	function setParentLanguageId(v: string) {
		parentLanguageId = v === '' ? null : Number(v)
	}

	const parentLanguageItems = $derived([
		{ value: '', label: m.wbc_none_root_language() },
		...existingLanguages.map(lang => ({ value: String(lang.id), label: lang.name })),
	])

	const languageTypeItems = [
		{ value: 'language', label: m.wbc_lang_type_language() },
		{ value: 'proto', label: m.wbc_lang_type_proto() },
		{ value: 'historical', label: m.wbc_lang_type_historical() },
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
			error = m.wbc_name_required()
			return
		}
		if (!isEditing && !slug.trim()) {
			error = m.wbc_slug_required()
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
			error = error_.message || m.wbc_failed_save_language()
		} finally {
			submitting = false
		}
	}

	const textareaClass = 'flex w-full min-w-0 px-3 py-2 text-sm text-body bg-page outline-none transition-colors placeholder:text-dim focus:ring-2 focus:ring-accent disabled:pointer-events-none disabled:opacity-50'
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<UnsavedChangesGuard when={isDirty && !submitting && !recordGone} />

	{#if error}
		<FormNotice title={m.wbc_language_not_saved()} message={error} />
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label={m.common_name()} bind:value={name} oninput={updateSlug} required placeholder="Oncheran" error={!name.trim() && error ? m.wbc_name_required() : ''} />
		{#if !isEditing}
			<Input label={m.wbc_slug()} bind:value={slug} required placeholder="oncheran" error={!slug.trim() && error ? m.wbc_slug_required() : ''} />
		{/if}
		<Input label={m.wbc_native_name()} bind:value={nativeName} placeholder="Ontsserako" />
		<Select
			label={m.wbc_parent_language()}
			type="single"
			value={parentLanguageIdStr}
			onValueChange={setParentLanguageId}
			items={parentLanguageItems}
			placeholder={m.wbc_none_root_language()}
		/>
		<Select
			label={m.common_type()}
			type="single"
			bind:value={languageType}
			items={languageTypeItems}
			placeholder={m.wbc_lang_type_language()}
		/>
		<div>
			<Label>
				{m.wbc_family()}
				{#if languageType === 'proto'}
					<span class="text-error">*</span>
				{:else}
					<span class="text-xs text-secondary">{m.wbc_inherits_from_parent()}</span>
				{/if}
			</Label>
			<Input
				bind:value={family}
				required={languageType === 'proto'}
				placeholder={languageType === 'proto' ? m.wbc_family_proto_placeholder() : m.wbc_family_inherit_placeholder()}
			/>
		</div>
		<Input label={m.wbc_script()} bind:value={script} placeholder="Latin" />
		<div>
			<Label>{m.wbc_accent_color()}</Label>
			<div class="flex gap-2 items-center mt-1">
				<input id="color" type="color" bind:value={color} class="size-10 cursor-pointer" />
				<Input bind:value={color} placeholder="#d97706" />
			</div>
		</div>
	</div>

	<Input label={m.wbc_wiki_article()} bind:value={pageSlug} placeholder="oncheran_language" />

	<div>
		<Label for="desc">{m.common_description()}</Label>
		<textarea id="desc" bind:value={description} rows={3} class={textareaClass} placeholder={m.wbc_language_description_placeholder()}></textarea>
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
