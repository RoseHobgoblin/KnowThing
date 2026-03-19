<script lang="ts">
	import type { ActionData, PageData } from './$types.js';
	import Editor from '$lib/components/Editor.svelte';
	import LivePreview from '$lib/components/LivePreview.svelte';

	let { form, data }: { form: ActionData; data: PageData } = $props();
	let content = $state(form?.content ?? '');
	let showPreview = $state(true);
</script>

<svelte:head>
	<title>Create page - KnowThing</title>
</svelte:head>

<h1 class="text-xl  font-bold mb-3">Create new page</h1>

{#if form?.error}
	<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-3 text-sm">
		{form.error}
	</div>
{/if}

<form method="POST" class="flex flex-col" style="height: calc(100vh - 220px);">
	<input type="hidden" name="content" value={content} />

	<div class="flex items-center gap-4 mb-3">
		<div class="flex-1">
			<input
				name="title"
				type="text"
				required
				placeholder="Page title"
				value={form?.title ?? data.suggestedTitle}
				class="w-full border border-stone-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
			/>
		</div>
		<button
			onclick={() => (showPreview = !showPreview)}
			type="button"
			class="px-3 py-1.5 rounded border border-stone-300 hover:bg-stone-50 text-sm {showPreview ? 'bg-amber-50 border-amber-300' : ''}"
		>
			{showPreview ? 'Hide preview' : 'Show preview'}
		</button>
	</div>

	<div class="flex-1 flex gap-4 min-h-0">
		<div class="{showPreview ? 'w-1/2' : 'w-full'}">
			<Editor value={form?.content ?? ''} onchange={(v) => (content = v)} />
		</div>

		{#if showPreview}
			<div class="w-1/2 border border-stone-300 rounded overflow-hidden">
				<div class="bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 border-b border-stone-300">Preview</div>
				<LivePreview {content} />
			</div>
		{/if}
	</div>

	<div class="mt-3 pt-3 border-t border-stone-200">
		<button
			type="submit"
			class="bg-amber-600 text-white px-4 py-1.5 rounded font-medium hover:bg-amber-700 transition-colors text-sm"
		>
			Create page
		</button>
	</div>
</form>
