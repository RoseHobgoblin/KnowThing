<script lang="ts">
	import type { ActionData, PageData } from './$types.js'
	import { enhance } from '$app/forms'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import Input from '$lib/components/ui/Input.svelte'

	let { form, data }: { form: ActionData, data: PageData } = $props()
	let content = $state(data.body)
	let showPreview = $state(true)
	let submitting = $state(false)
	let editSummary = $state('')
	const isDirty = $derived(content !== data.body || editSummary.trim().length > 0)
	const saveError = $derived(form?.error ?? '')
</script>

<svelte:head>
	<title>Editing {data.title} — Wordbook</title>
</svelte:head>

<div>
	<UnsavedChangesGuard when={isDirty && !submitting} />
	<form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { submitting = false; await update() } }} class="flex flex-col h-[calc(100vh-5rem)]">
		<input type="hidden" name="content" value={content} />
		<input type="hidden" name="entityKind" value="language" />
		<input type="hidden" name="entityId" value={data.entityId} />
		<input type="hidden" name="title" value={data.title} />
		<input type="hidden" name="summary" value={editSummary} />

		<RecordModeBanner
			modeLabel="Edit Language"
			title="Language Article Editor"
			description="Edit the prose body that appears below the language's structured data. Changes are wiki-markup."
		/>

		{#if saveError}
			<div class="px-6 pt-4">
				<FormNotice title="Changes were not saved" message={saveError} />
			</div>
		{/if}

		<div class="flex items-center justify-between px-6 py-2 bg-surface border-b border-border">
			<h1 class="text-sm font-bold text-secondary truncate">
				Editing: <span class="text-heading">{data.title}</span>
			</h1>
			<div class="flex items-center gap-2">
				<SaveStatusBadge dirty={isDirty} saving={submitting} error={saveError} />
				<button
					type="button"
					onclick={() => (showPreview = !showPreview)}
					class="px-3 py-1 border border-border text-xs text-secondary hover:bg-raised {showPreview ? 'bg-accent-subtle border-accent-border text-accent' : ''}"
				>
					{showPreview ? 'Hide preview' : 'Show preview'}
				</button>
			</div>
		</div>

		<div class="flex-1 flex flex-col min-h-0 md:flex-row">
			<div class="flex-1 min-h-0 min-w-0 overflow-hidden {showPreview ? 'h-1/2 md:h-auto' : ''}">
				<Editor value={data.body} onchange={v => (content = v)} />
			</div>

			{#if showPreview}
				<div class="w-full h-1/2 border-l border-border bg-surface flex flex-col min-h-0 shrink-0 md:w-[45%] md:max-w-2xl md:h-auto">
					<div class="bg-raised px-6 py-1.5 text-xs font-medium text-faint border-b border-border-subtle uppercase tracking-wide">Preview</div>
					<div class="flex-1 overflow-y-auto px-6 py-4">
						<LivePreview {content} />
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-col items-stretch gap-2 px-6 py-2.5 bg-surface border-t border-border sm:flex-row sm:items-center sm:gap-3">
			<Input type="text" bind:value={editSummary} placeholder="Edit summary (optional)" class="flex-1" />
			<div class="flex gap-2">
				<button
					type="submit"
					disabled={submitting}
					class="flex-1 bg-accent text-accent-text px-5 py-2 font-medium transition-colors text-sm sm:flex-none hover:bg-accent-hover disabled:opacity-50"
				>
					{submitting ? 'Saving...' : 'Save'}
				</button>
				<a
					href="/Wordbook/{data.slug}"
					class="flex-1 text-center px-5 py-2 border border-border text-secondary text-sm sm:flex-none hover:bg-raised"
				>
					Cancel
				</a>
			</div>
		</div>
	</form>
</div>
