<script lang="ts">
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Move: {data.title} — KnowThing</title>
</svelte:head>

<div class="bg-white rounded-lg shadow-sm border border-stone-200 p-6 max-w-lg">
	<h1 class="text-xl font-bold text-stone-900 mb-1">Move / Rename Page</h1>
	<p class="text-sm text-stone-500 mb-6">
		Moving <a href="/know/{data.slug}" class="text-amber-700 hover:underline">{data.title}</a>
	</p>

	{#if form?.error}
		<div class="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700">
			{form.error}
		</div>
	{/if}

	<form method="POST" class="space-y-4">
		<div>
			<label for="title" class="block text-sm font-medium text-stone-700 mb-1">New title</label>
			<input
				type="text"
				id="title"
				name="title"
				value={data.title}
				required
				class="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
			/>
		</div>

		<div>
			<label for="slug" class="block text-sm font-medium text-stone-700 mb-1">New URL slug</label>
			<div class="flex items-center gap-1 text-sm text-stone-400">
				<span>/know/</span>
				<input
					type="text"
					id="slug"
					name="slug"
					value={data.slug}
					required
					class="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
				/>
			</div>
		</div>

		<div class="flex gap-3 pt-2">
			<button
				type="submit"
				class="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
			>
				Move Page
			</button>
			<a
				href="/know/{data.slug}"
				class="px-5 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors"
			>
				Cancel
			</a>
		</div>
	</form>
</div>
