<script lang="ts">
	import { untrack } from 'svelte'
	import type { ActionData, PageData } from './$types.js'
	import { enhance } from '$app/forms'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'
	import UnsavedChangesGuard from '$lib/components/editor/UnsavedChangesGuard.svelte'
	import RecordModeBanner from '$lib/components/editor/RecordModeBanner.svelte'
	import FormNotice from '$lib/components/editor/FormNotice.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import { m } from '$lib/paraglide/messages.js'

	let { form, data }: { form: ActionData, data: PageData } = $props()
	let content = $state(untrack(() => data.content))
	let showPreview = $state(true)
	let submitting = $state(false)
	let editSummary = $state('')
	const isDirty = $derived(content !== data.content || editSummary.trim().length > 0)
	const saveError = $derived(form?.error ?? '')
</script>

<svelte:head>
	<title>{m.know_editing({ name: data.title })} — KnowThing</title>
</svelte:head>

<div>
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
		class="flex h-[calc(100vh-5rem)] flex-col"
	>
		<input type="hidden" name="content" value={content} />
		<input type="hidden" name="summary" value={editSummary} />

		<RecordModeBanner
			modeLabel={m.know_edit_article_mode()}
			title={m.know_wiki_article_editor()}
			description={m.know_edit_article_desc()}
		/>

		{#if saveError}
			<div class="px-6 pt-4">
				<FormNotice title={m.know_changes_not_saved()} message={saveError} />
			</div>
		{/if}

		<!-- Top bar -->
		<div class="flex items-center justify-between border-b border-border bg-surface px-6 py-2">
			<h1 class="truncate text-sm font-bold text-secondary">
				{m.know_editing_label()} <span class="text-heading">{data.title}</span>
			</h1>
			<div class="flex items-center gap-2">
				<SaveStatusBadge dirty={isDirty} saving={submitting} error={saveError} />
				<button
					type="button"
					onclick={() => (showPreview = !showPreview)}
					class="px-3 py-1 text-xs text-secondary hover:bg-raised {showPreview ? 'border-accent-border bg-accent-subtle text-accent' : ''}"
				>
					{showPreview ? m.know_hide_preview() : m.know_show_preview()}
				</button>
			</div>
		</div>

		<!-- Editor + Preview -->
		<div class="flex min-h-0 flex-1 flex-col md:flex-row">
			<!-- Editor pane -->
			<div class="min-h-0 min-w-0 flex-1 overflow-hidden {showPreview ? 'h-1/2 md:h-auto' : ''}">
				<Editor value={data.content} onchange={v => (content = v)} />
			</div>

			<!-- Preview pane -->
			{#if showPreview}
				<div class="flex h-1/2 min-h-0 w-full shrink-0 flex-col border-l border-border bg-surface md:h-auto md:w-[45%] md:max-w-2xl">
					<div class="border-b border-border-subtle bg-raised px-6 py-1.5 text-xs font-medium tracking-wide text-secondary uppercase">{m.common_preview()}</div>
					<div class="flex-1 overflow-y-auto px-6 py-4">
						<LivePreview {content} />
					</div>
				</div>
			{/if}
		</div>

		<!-- Bottom bar -->
		<div class="flex flex-col items-stretch gap-2 border-t border-border bg-surface px-6 py-2.5 sm:flex-row sm:items-center sm:gap-3">
			<Input
				type="text"
				bind:value={editSummary}
				placeholder={m.know_edit_summary_placeholder()}
				class="flex-1"
			/>
			<div class="flex gap-2">
				<button
					type="submit"
					disabled={submitting}
					class="flex-1 bg-accent px-5 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-50 sm:flex-none"
				>
					{submitting ? m.common_saving() : m.common_save()}
				</button>
				<a
					href="/know/{data.slug}"
					class="flex-1 px-5 py-2 text-center text-sm text-secondary hover:bg-raised sm:flex-none"
				>
					{m.common_cancel()}
				</a>
			</div>
		</div>
	</form>
</div>
