<script lang="ts">
	import type { ActionData, PageData } from './$types.js'
	import { enhance } from '$app/forms'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'

	let { form, data }: { form: ActionData, data: PageData } = $props()
	let content = $state(data.content)
	let showPreview = $state(true)
	let submitting = $state(false)
	let editSummary = $state('')
	const isDirty = $derived(content !== data.content || editSummary.trim().length > 0)
	const saveError = $derived(form?.error ?? '')
</script>

<svelte:head>
	<title>Editing {data.title} — KnowThing</title>
</svelte:head>

<div>
	<UnsavedChangesGuard when={isDirty && !submitting} />
	<form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { submitting = false; await update() } }} class="flex flex-col h-[calc(100vh-5rem)]">
		<input type="hidden" name="content" value={content} />
		<input type="hidden" name="summary" value={editSummary} />

		<RecordModeBanner
			modeLabel="Edit Article"
			title="Wiki Article Editor"
			description="Edit article prose and wiki markup here. Structured record changes belong in configure screens."
		/>

		{#if saveError}
			<div class="px-6 pt-4">
				<FormNotice title="Article changes were not saved" message={saveError} />
			</div>
		{/if}

		<!-- Top bar -->
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

		<!-- Editor + Preview -->
		<div class="flex-1 flex flex-col min-h-0 md:flex-row">
			<!-- Editor pane -->
			<div class="flex-1 min-h-0 min-w-0 overflow-hidden {showPreview ? 'h-1/2 md:h-auto' : ''}">
				<Editor value={data.content} onchange={v => (content = v)} />
			</div>

			<!-- Preview pane -->
			{#if showPreview}
				<div class="
					w-full h-1/2 border-l border-border bg-surface flex flex-col min-h-0 shrink-0
					md:w-[45%] md:max-w-2xl md:h-auto
				">
					<div class="
						bg-raised px-6 py-1.5 text-xs font-medium text-faint border-b border-border-subtle uppercase
						tracking-wide
					">Preview</div>
					<div class="flex-1 overflow-y-auto px-6 py-4">
						<LivePreview {content} />
					</div>
				</div>
			{/if}
		</div>

		<!-- Bottom bar -->
		<div class="
			flex flex-col items-stretch gap-2 px-6 py-2.5 bg-surface border-t border-border
			sm:flex-row sm:items-center sm:gap-3
		">
			<input
				type="text"
				bind:value={editSummary}
				placeholder="Edit summary (optional)"
				class="
					flex-1 border border-border px-3 py-2 text-sm bg-page text-body
					focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border
				"
			/>
			<div class="flex gap-2">
				<button
					type="submit"
					disabled={submitting}
					class="
						flex-1 bg-accent text-accent-text px-5 py-2 font-medium transition-colors text-sm
						sm:flex-none
						hover:bg-accent-hover disabled:opacity-50
					"
				>
					{submitting ? 'Saving...' : 'Save'}
				</button>
				<a
					href="/know/{data.slug}"
					class="
						flex-1 text-center px-5 py-2 border border-border text-secondary text-sm
						sm:flex-none
						hover:bg-raised
					"
				>
					Cancel
				</a>
			</div>
		</div>
	</form>
</div>
