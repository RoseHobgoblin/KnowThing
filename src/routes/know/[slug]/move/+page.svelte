<script lang="ts">
	import type { PageData, ActionData } from './$types.js'
	import { enhance } from '$app/forms'
	import Input from '$lib/components/ui/Input.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'

	let { data, form }: { data: PageData, form: ActionData } = $props()
	let submitting = $state(false)
	let title = $state(form?.title ?? data.title)
	let slug = $state(form?.slug ?? data.slug)
	const isDirty = $derived(title !== data.title || slug !== data.slug)
	const titleError = $derived(form?.error === 'Title is required' ? form.error : '')
	const slugError = $derived(form?.error === 'Slug is required' ? form.error : '')
	const formError = $derived(
		form?.error && form.error !== titleError && form.error !== slugError ? form.error : '',
	)
</script>

<svelte:head>
	<title>Move: {data.title} - KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm border border-border p-6 max-w-lg">
	<RecordModeBanner
		modeLabel="Move Article"
		title="Rename or relocate article"
		description="Change the article title and canonical slug here. Content stays the same; this only updates the record identity."
	/>

	{#if formError}
		<div class="mt-4">
			<FormNotice title="Article move was not saved" message={formError} />
		</div>
	{/if}

	<UnsavedChangesGuard when={isDirty && !submitting} />
	<form
		method="POST"
		use:enhance={() => {
			submitting = true
			return async ({ update }) => {
				submitting = false
				await update()
			}
		}}
		class="space-y-4"
	>
		<div class="flex items-center justify-between gap-3 pt-4">
			<p class="text-sm text-dim">
				Moving <a href="/know/{data.slug}" class="text-link hover:underline">{data.title}</a>
			</p>
			<SaveStatusBadge dirty={isDirty} saving={submitting} error={formError || titleError || slugError} />
		</div>

		<Input
			label="New title"
			name="title"
			required
			bind:value={title}
			error={titleError}
		/>

		<div>
			<label for="slug" class="block text-sm font-medium text-secondary mb-1">New URL slug</label>
			<div class="flex items-center gap-1 text-sm text-faint">
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
				class="
					px-5 py-2 bg-accent text-surface text-sm font-medium transition-colors
					hover:bg-accent-hover disabled:opacity-50
				"
			>
				{submitting ? 'Moving...' : 'Move Page'}
			</button>
			<a
				href="/know/{data.slug}"
				class="
					px-5 py-2 bg-raised text-secondary text-sm font-medium transition-colors
					hover:bg-border
				"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
