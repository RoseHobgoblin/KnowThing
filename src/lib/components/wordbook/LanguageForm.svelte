<script lang="ts">
	import { untrack } from 'svelte'
	import { createSpaForm } from '$lib/forms/spa-form.svelte.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import Label from '$lib/components/ui/Label.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import { urlSlugify } from '$lib/utils/slugify.js'
	import { languageFormSchema, toLanguagePayload, type LanguageType } from '$lib/wordbook/language-form-schema.js'

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
		languageType: (initialSnapshot.languageType || 'language') as LanguageType,
	}

	const isEditing = !!initialValues.name

	const spa = createSpaForm({
		schema: languageFormSchema,
		initial: initialValues,
		errorMessage: 'Failed to save language',
		onValid: data => onsubmit(toLanguagePayload(data)),
	})
	const { form, errors, enhance, submitting, reset, clearError } = spa

	function updateSlug() {
		if (isEditing) return
		if (!$form.slug || $form.slug === urlSlugify($form.name.slice(0, -1))) {
			$form.slug = urlSlugify($form.name)
		}
	}

	let parentLanguageIdString = $derived($form.parentLanguageId === null ? '' : String($form.parentLanguageId))

	function setParentLanguageId(v: string) {
		$form.parentLanguageId = v === '' ? null : Number(v)
	}

	function discard() {
		clearError()
		reset()
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

	const textareaClass = 'flex w-full min-w-0 px-3 py-2 text-sm text-body bg-page outline-none transition-colors placeholder:text-dim focus:ring-2 focus:ring-accent disabled:pointer-events-none disabled:opacity-50'
</script>

<form method="POST" use:enhance class="space-y-4">
	<UnsavedChangesGuard when={spa.isDirty && !$submitting} />

	{#if spa.submitError}
		<FormNotice title="Language changes were not saved" message={spa.submitError} />
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<Input label="Name" bind:value={$form.name} oninput={updateSlug} required placeholder="Oncheran" error={$errors.name?.[0]} />
		{#if !isEditing}
			<Input label="Slug" bind:value={$form.slug} required placeholder="oncheran" error={$errors.slug?.[0]} />
		{/if}
		<Input label="Native Name" bind:value={$form.nativeName} placeholder="Ontsserako" />
		<Select
			label="Parent Language"
			type="single"
			value={parentLanguageIdString}
			onValueChange={setParentLanguageId}
			items={parentLanguageItems}
			placeholder="None (root language)"
		/>
		<Select
			label="Type"
			type="single"
			bind:value={$form.languageType}
			items={languageTypeItems}
			placeholder="Language"
		/>
		<div>
			<Label>
				Family
				{#if $form.languageType === 'proto'}
					<span class="text-error">*</span>
				{:else}
					<span class="text-xs text-secondary">(inherits from parent)</span>
				{/if}
			</Label>
			<Input
				bind:value={$form.family}
				required={$form.languageType === 'proto'}
				placeholder={$form.languageType === 'proto' ? 'e.g. Mirish' : 'Leave blank to inherit'}
				error={$errors.family?.[0]}
			/>
		</div>
		<Input label="Script" bind:value={$form.script} placeholder="Latin" />
		<div>
			<Label>Accent Color</Label>
			<div class="flex gap-2 items-center mt-1">
				<input id="color" type="color" bind:value={$form.color} class="size-10 cursor-pointer" />
				<Input bind:value={$form.color} placeholder="#d97706" />
			</div>
		</div>
	</div>

	<Input label="Wiki Article" bind:value={$form.pageSlug} placeholder="oncheran_language" />

	<div>
		<Label for="desc">Description</Label>
		<textarea id="desc" bind:value={$form.description} rows={3} class={textareaClass} placeholder="A brief description of this language..."></textarea>
	</div>

	<StickyActionBar
		dirty={spa.isDirty}
		saving={$submitting}
		error={spa.submitError}
		saveType="submit"
		ondiscard={discard}
		saveLabel={submitLabel}
	/>
</form>
