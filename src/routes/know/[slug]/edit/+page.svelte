<script lang="ts">
	import type { ActionData, PageData } from './$types.js'
	import Editor from '$lib/components/Editor.svelte'
	import LivePreview from '$lib/components/LivePreview.svelte'

	let { form, data }: { form: ActionData, data: PageData } = $props()
	let content = $state(data.content)
	let showPreview = $state(true)
	let editorRef: Editor
</script>

<svelte:head>
	<title>Editing {data.title} — KnowThing</title>
</svelte:head>

<!-- Break out of max-w-4xl container to use full width -->
<div class="relative" style="width: 100vw; margin-left: calc(-50vw + 50%);">
	<form method="POST" class="flex flex-col h-[calc(100vh-140px)]">
		<input type="hidden" name="content" value={content} />

		<!-- Top bar -->
		<div class="flex items-center justify-between px-4 py-2 bg-surface border-b border-border">
			<h1 class="text-sm font-bold text-secondary truncate">
				Editing: <span class="text-heading">{data.title}</span>
			</h1>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => (showPreview = !showPreview)}
					class="px-3 py-1 rounded-sm border border-border text-xs text-secondary hover:bg-page {showPreview ? 'bg-accent-subtle border-accent-border text-link' : ''}"
				>
					{showPreview ? 'Hide preview' : 'Show preview'}
				</button>
			</div>
		</div>

		<!-- Editor + Preview -->
		<div class="flex-1 flex flex-col min-h-0 md:flex-row">
			<!-- Editor pane — takes all remaining space -->
			<div class="flex-1 min-h-0 {showPreview ? 'h-1/2 md:h-auto' : ''}">
				<Editor value={data.content} onchange={v => (content = v)} bind:this={editorRef} />
			</div>

			<!-- Preview pane — fixed width on right, like the article page -->
			{#if showPreview}
				<div class="
					w-full h-1/2 border-l border-border bg-surface flex flex-col min-h-0 shrink-0
					md:max-w-4xl md:h-auto
				">
					<div class="
						bg-page px-4 py-1.5 text-xs font-medium text-faint border-b border-border-subtle uppercase
						tracking-wide
					">Preview</div>
					<div class="flex-1 overflow-y-auto">
						<LivePreview {content} />
					</div>
				</div>
			{/if}
		</div>

		<!-- Bottom bar -->
		<div class="
			flex flex-col items-stretch gap-2 px-4 py-2.5 bg-surface border-t border-border
			sm:flex-row sm:items-center sm:gap-3
		">
			<input
				name="summary"
				type="text"
				placeholder="Edit summary (optional)"
				class="
					flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-page
					focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent-border
				"
			/>
			<div class="flex gap-2">
				<button
					type="submit"
					class="
						flex-1 bg-accent text-surface px-5 py-2 rounded-lg font-medium transition-colors text-sm
						sm:flex-none
						hover:bg-accent-hover
					"
				>
					Save
				</button>
				<a
					href="/know/{data.slug}"
					class="
						flex-1 text-center px-5 py-2 rounded-lg border border-border text-secondary text-sm
						sm:flex-none
						hover:bg-page
					"
				>
					Cancel
				</a>
			</div>
		</div>
	</form>
</div>
