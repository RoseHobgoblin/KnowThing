<script lang="ts">
	import { untrack } from 'svelte'
	import type { ActionData, PageData } from './$types.js'
	import { enhance } from '$app/forms'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'

	let { form, data }: { form: ActionData, data: PageData } = $props()
	let content = $state(untrack(() => form?.content ?? ''))
	let showPreview = $state(true)
	let submitting = $state(false)
	let title = $state(untrack(() => form?.title ?? data.suggestedTitle))
	const isDirty = $derived(content.trim().length > 0 || title.trim().length > 0)
	const titleError = $derived(form?.error && !title.trim() ? form.error : '')
	const formError = $derived(titleError ? '' : (form?.error ?? ''))
</script>

<svelte:head>
	<title>Create page - KnowThing</title>
</svelte:head>

{#if formError}
	<div class="mb-3">
		<FormNotice title="Article was not created" message={formError} />
	</div>
{/if}

<UnsavedChangesGuard when={isDirty && !submitting} />
<form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { submitting = false; await update() } }} class="flex flex-col" style="height: calc(100vh - 220px);">
	<input type="hidden" name="content" value={content} />

	<div class="flex items-center gap-4 mb-3">
		<div class="flex-1">
			<Input
				name="title"
				type="text"
				required
				placeholder="Page title"
				bind:value={title}
				error={titleError}
			/>
		</div>
		<SaveStatusBadge dirty={isDirty} saving={submitting} error={formError || titleError} />
		<button
			onclick={() => (showPreview = !showPreview)}
			type="button"
			class="px-3 py-1.5 text-sm hover:bg-page {showPreview ? 'bg-accent-subtle border-accent-border' : ''}"
		>
			{showPreview ? 'Hide preview' : 'Show preview'}
		</button>
	</div>

	<div class="flex-1 flex gap-4 min-h-0">
		<div class="{showPreview ? 'w-1/2' : 'w-full'}">
			<Editor value={form?.content ?? ''} onchange={v => (content = v)} />
		</div>

		{#if showPreview}
			<div class="w-1/2 overflow-hidden">
				<div class="bg-raised px-3 py-1 text-xs font-medium text-dim border-b border-border-strong">Preview</div>
				<LivePreview {content} />
			</div>
		{/if}
	</div>

	<div class="mt-3 pt-3 border-t border-border">
		<button
			type="submit"
			disabled={submitting}
			class="
				bg-accent text-surface px-4 py-1.5 font-medium transition-colors text-sm
				hover:bg-accent-hover disabled:opacity-50
			"
		>
			{submitting ? 'Creating...' : 'Create page'}
		</button>
	</div>
</form>
