<script lang="ts">
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import Button from '$lib/components/ui/Button.svelte'

	let {
		initialContent = '',
		content = $bindable(''),
		editSummary = $bindable(''),
		cancelHref,
		saving = false,
		onsave,
		submitType = 'button',
		summaryName,
	}: {
		initialContent?: string
		content?: string
		editSummary?: string
		cancelHref: string
		saving?: boolean
		onsave?: () => void
		/** Set to 'submit' for native form submission (CalendarConfigure) */
		submitType?: 'button' | 'submit'
		/** Set a name attribute on the summary input for native form submission */
		summaryName?: string
	} = $props()

	let showPreview = $state(true)
</script>

<!-- Wiki Content -->
<section class="bg-raised border border-border-subtle p-5 space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-semibold text-heading">Article Content</h2>
		<button type="button" onclick={() => showPreview = !showPreview} class="px-3 py-1 border border-border text-xs text-secondary hover:bg-surface {showPreview ? 'bg-accent-subtle border-accent-border text-accent' : ''}">
			{showPreview ? 'Hide preview' : 'Show preview'}
		</button>
	</div>
	<div class="flex flex-col min-h-0 md:flex-row gap-4">
		<div class="flex-1 min-h-[300px] border border-border">
			<Editor value={initialContent} onchange={v => (content = v)} />
		</div>
		{#if showPreview}
			<div class="flex-1 min-h-[300px] border border-border bg-surface flex flex-col">
				<div class="bg-page px-4 py-1.5 text-xs font-medium text-faint border-b border-border-subtle uppercase tracking-wide">Preview</div>
				<div class="flex-1 overflow-y-auto px-4 py-4">
					<LivePreview {content} />
				</div>
			</div>
		{/if}
	</div>
</section>

<!-- Submit -->
<div class="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
	<Input bind:value={editSummary} name={summaryName} placeholder="Edit summary (optional)" containerClass="flex-1" />
	<div class="flex gap-2">
		{#if submitType === 'submit'}
			<Button type="submit">Save</Button>
		{:else}
			<Button onclick={onsave} loading={saving} disabled={saving}>Save</Button>
		{/if}
		<Button variant="secondary" href={cancelHref}>Cancel</Button>
	</div>
</div>
