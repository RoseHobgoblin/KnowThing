<script lang="ts">
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'
	import Input from '$lib/components/ui/Input.svelte'
	import StickyActionBar from '$lib/components/editor/StickyActionBar.svelte'

	let {
		initialContent = '',
		content = $bindable(''),
		editSummary = $bindable(''),
		cancelHref,
		saving = false,
		dirty = false,
		error = '',
		savedAt = null,
		onsave,
		onsaveandexit,
		ondiscard,
		submitType = 'button',
		summaryName,
	}: {
		initialContent?: string
		content?: string
		editSummary?: string
		cancelHref: string
		saving?: boolean
		dirty?: boolean
		error?: string
		savedAt?: Date | null
		onsave?: () => void
		onsaveandexit?: () => void
		ondiscard?: () => void
		/** Set to 'submit' for native form submission (CalendarConfigure) */
		submitType?: 'button' | 'submit'
		/** Set a name attribute on the summary input for native form submission */
		summaryName?: string
	} = $props()

	let showPreview = $state(true)
</script>

<!-- Wiki Content -->
<section class="bg-raised p-5 space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-sm font-semibold text-heading">Article Content</h2>
		<button type="button" onclick={() => showPreview = !showPreview} class="px-3 py-1 text-xs text-secondary hover:bg-surface {showPreview ? 'bg-accent-subtle border-accent-border text-accent' : ''}">
			{showPreview ? 'Hide preview' : 'Show preview'}
		</button>
	</div>
	<div class="flex flex-col min-h-0 gap-4 md:flex-row">
		<div class="flex-1 min-h-75">
			<Editor value={initialContent} onchange={v => (content = v)} />
		</div>
		{#if showPreview}
			<div class="flex-1 min-h-75 bg-surface flex flex-col">
				<div class="bg-page px-4 py-1.5 text-xs font-medium text-secondary border-b border-border-subtle uppercase tracking-wide">Preview</div>
				<div class="flex-1 overflow-y-auto p-4">
					<LivePreview {content} />
				</div>
			</div>
		{/if}
	</div>
</section>

<!-- Submit -->
<div class="space-y-3">
	<div class="rounded-sm bg-page px-4 py-3">
		<Input bind:value={editSummary} name={summaryName} placeholder="Edit summary (optional)" />
	</div>
	<StickyActionBar
		{dirty}
		{saving}
		{error}
		{savedAt}
		saveType={submitType}
		onsave={onsave}
		onsaveandexit={onsaveandexit}
		ondiscard={ondiscard}
		cancelHref={cancelHref}
	/>
</div>
