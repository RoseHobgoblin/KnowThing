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
	import { m } from '$lib/paraglide/messages.js'

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
	<title>{m.know_create_page()} - KnowThing</title>
</svelte:head>

{#if formError}
	<div class="mb-3">
		<FormNotice title={m.know_article_not_created()} message={formError} />
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
	class="flex flex-col"
	style="height: calc(100vh - 220px);"
>
	<input type="hidden" name="content" value={content} />

	<div class="mb-3 flex items-center gap-4">
		<div class="flex-1">
			<Input
				name="title"
				type="text"
				required
				placeholder={m.know_page_title_placeholder()}
				bind:value={title}
				error={titleError}
			/>
		</div>
		<SaveStatusBadge dirty={isDirty} saving={submitting} error={formError || titleError} />
		<button
			onclick={() => (showPreview = !showPreview)}
			type="button"
			class="px-3 py-1.5 text-sm hover:bg-page {showPreview ? 'border-accent-border bg-accent-subtle' : ''}"
		>
			{showPreview ? m.know_hide_preview() : m.know_show_preview()}
		</button>
	</div>

	<div class="flex min-h-0 flex-1 gap-4">
		<div class="{showPreview ? 'w-1/2' : 'w-full'}">
			<Editor value={form?.content ?? ''} onchange={v => (content = v)} />
		</div>

		{#if showPreview}
			<div class="w-1/2 overflow-hidden">
				<div class="border-b border-border-strong bg-raised px-3 py-1 text-xs font-medium text-dim">{m.common_preview()}</div>
				<LivePreview {content} />
			</div>
		{/if}
	</div>

	<div class="mt-3 border-t border-border pt-3">
		<button
			type="submit"
			disabled={submitting}
			class="bg-accent px-4 py-1.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-50"
		>
			{submitting ? m.common_creating() : m.know_create_page()}
		</button>
	</div>
</form>
