<script lang="ts">
	import { untrack } from 'svelte'
	import type { PageData, ActionData } from './$types.js'
	import { enhance } from '$app/forms'
	import Input from '$lib/components/ui/Input.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import { m } from '$lib/paraglide/messages.js'

	let { data, form }: { data: PageData, form: ActionData } = $props()
	let submitting = $state(false)
	let title = $state(untrack(() => form?.title ?? data.title))
	let slug = $state(untrack(() => form?.slug ?? data.slug))
	const isDirty = $derived(title !== data.title || slug !== data.slug)
	const titleError = $derived(form?.error === 'Title is required' ? m.know_title_required() : '')
	const slugError = $derived(form?.error === 'Slug is required' ? m.know_slug_required() : '')
	const formError = $derived(
		form?.error && form.error !== 'Title is required' && form.error !== 'Slug is required'
			? form.error
			: '',
	)
</script>

<svelte:head>
	<title>{m.know_move_title({ name: data.title })} - KnowThing</title>
</svelte:head>

<div class="max-w-lg bg-surface p-6 shadow-sm">
	<RecordModeBanner
		modeLabel={m.know_move_article_mode()}
		title={m.know_rename_relocate()}
		description={m.know_move_desc()}
	/>

	{#if formError}
		<div class="mt-4">
			<FormNotice title={m.know_move_not_saved()} message={formError} />
		</div>
	{/if}

	<UnsavedChangesGuard when={isDirty && !submitting} />
	<form
		method="POST"
		use:enhance={() => {
			submitting = true
			return async ({ update }) => {
				await update()
				submitting = false
			}
		}}
		class="space-y-4"
	>
		<div class="flex items-center justify-between gap-3 pt-4">
			<p class="text-sm text-dim">
				{m.know_moving_label()} <a href="/know/{data.slug}" class="text-link hover:underline">{data.title}</a>
			</p>
			<SaveStatusBadge dirty={isDirty} saving={submitting} error={formError || titleError || slugError} />
		</div>

		<Input
			label={m.know_new_title()}
			name="title"
			required
			bind:value={title}
			error={titleError}
		/>

		<div>
			<label for="slug" class="mb-1 block text-sm font-medium text-secondary">{m.know_new_slug()}</label>
			<div class="flex items-center gap-1 text-sm text-secondary">
				<span>/know/</span>
				<Input
					id="slug"
					name="slug"
					required
					bind:value={slug}
					containerClass="flex-1"
					error={slugError}
				/>
			</div>
		</div>

		<div class="flex gap-3 pt-2">
			<button
				type="submit"
				disabled={submitting}
				class="bg-accent px-5 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				{submitting ? m.know_moving_status() : m.know_move_page()}
			</button>
			<a
				href="/know/{data.slug}"
				class="bg-raised px-5 py-2 text-sm font-medium text-secondary transition-colors hover:bg-border"
			>
				{m.common_cancel()}
			</a>
		</div>
	</form>
</div>
