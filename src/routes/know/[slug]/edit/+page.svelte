<script lang="ts">
	import type { ActionData, PageData } from './$types.js';
	import Editor from '$lib/components/Editor.svelte';
	import LivePreview from '$lib/components/LivePreview.svelte';

	let { form, data }: { form: ActionData; data: PageData } = $props();
	let content = $state(data.content);
	let showPreview = $state(true);
	let editorRef: Editor;
</script>

<svelte:head>
	<title>Editing {data.title} — KnowThing</title>
</svelte:head>

<!-- Break out of max-w-4xl container to use full width -->
<div class="relative" style="width: 100vw; margin-left: calc(-50vw + 50%);">
	<form method="POST" class="flex flex-col h-[calc(100vh-140px)]">
		<input type="hidden" name="content" value={content} />

		<!-- Top bar -->
		<div class="flex items-center justify-between px-4 py-2 bg-white border-b border-stone-200">
			<h1 class="text-sm font-bold text-stone-700 truncate">
				Editing: <span class="text-stone-900">{data.title}</span>
			</h1>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={() => (showPreview = !showPreview)}
					class="px-3 py-1 rounded border border-stone-200 hover:bg-stone-50 text-xs text-stone-600 {showPreview ? 'bg-amber-50 border-amber-300 text-amber-700' : ''}"
				>
					{showPreview ? 'Hide preview' : 'Show preview'}
				</button>
			</div>
		</div>

		<!-- Editor + Preview -->
		<div class="flex-1 flex flex-col md:flex-row min-h-0">
			<!-- Editor pane — takes all remaining space -->
			<div class="flex-1 min-h-0 {showPreview ? 'h-1/2 md:h-auto' : ''}">
				<Editor value={data.content} onchange={(v) => (content = v)} bind:this={editorRef} />
			</div>

			<!-- Preview pane — fixed width on right, like the article page -->
			{#if showPreview}
				<div class="w-full md:w-[28rem] lg:w-[32rem] xl:w-[36rem] h-1/2 md:h-auto border-l border-stone-200 bg-white flex flex-col min-h-0 shrink-0">
					<div class="bg-stone-50 px-4 py-1.5 text-xs font-medium text-stone-400 border-b border-stone-100 uppercase tracking-wide">Preview</div>
					<div class="flex-1 overflow-y-auto">
						<LivePreview {content} />
					</div>
				</div>
			{/if}
		</div>

		<!-- Bottom bar -->
		<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 px-4 py-2.5 bg-white border-t border-stone-200">
			<input
				name="summary"
				type="text"
				placeholder="Edit summary (optional)"
				class="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
			/>
			<div class="flex gap-2">
				<button
					type="submit"
					class="flex-1 sm:flex-none bg-amber-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm"
				>
					Save
				</button>
				<a
					href="/know/{data.slug}"
					class="flex-1 sm:flex-none text-center px-5 py-2 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm"
				>
					Cancel
				</a>
			</div>
		</div>
	</form>
</div>
