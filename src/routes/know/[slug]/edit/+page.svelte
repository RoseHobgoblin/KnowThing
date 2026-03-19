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
	<title>Editing {data.title} - KnowThing</title>
</svelte:head>

<div class="flex items-center justify-between mb-3">
	<h1 class="text-xl  font-bold">Editing: {data.title}</h1>
	<div class="flex gap-2 text-sm">
		<button
			onclick={() => (showPreview = !showPreview)}
			class="px-3 py-1 rounded border border-stone-300 hover:bg-stone-50 {showPreview ? 'bg-amber-50 border-amber-300' : ''}"
		>
			{showPreview ? 'Hide preview' : 'Show preview'}
		</button>
	</div>
</div>

<form method="POST" class="flex flex-col" style="height: calc(100vh - 200px);">
	<!-- Hidden textarea for form submission -->
	<input type="hidden" name="content" value={content} />

	<div class="flex-1 flex gap-4 min-h-0">
		<!-- Editor pane -->
		<div class="{showPreview ? 'w-1/2' : 'w-full'}">
			<Editor value={data.content} onchange={(v) => (content = v)} bind:this={editorRef} />
		</div>

		<!-- Preview pane -->
		{#if showPreview}
			<div class="w-1/2 border border-stone-300 rounded overflow-hidden">
				<div class="bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 border-b border-stone-300">Preview</div>
				<LivePreview {content} />
			</div>
		{/if}
	</div>

	<!-- Bottom bar -->
	<div class="flex items-center gap-3 mt-3 pt-3 border-t border-stone-200">
		<input
			name="summary"
			type="text"
			placeholder="Edit summary (optional)"
			class="flex-1 border border-stone-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
		/>
		<button
			type="submit"
			class="bg-amber-600 text-white px-4 py-1.5 rounded font-medium hover:bg-amber-700 transition-colors text-sm"
		>
			Save
		</button>
		<a
			href="/know/{data.slug}"
			class="px-4 py-1.5 rounded border border-stone-300 text-stone-700 hover:bg-stone-50 text-sm"
		>
			Cancel
		</a>
	</div>
</form>
