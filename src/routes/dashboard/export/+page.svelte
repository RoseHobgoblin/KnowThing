<script lang="ts">
	import type { PageData, ActionData } from './$types.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function downloadExport() {
		if (!form?.download) return;
		const blob = new Blob([form.download], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = form.filename || 'knowthing-export.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	$effect(() => {
		if (form?.download) downloadExport();
	});
</script>

<svelte:head>
	<title>Export — KnowThing</title>
</svelte:head>

<div class="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
	<h1 class="text-xl font-bold text-stone-900 mb-2">Export Backup</h1>
	<p class="text-sm text-stone-500 mb-6">
		Download all articles as a JSON file. This includes {data.pageCount} articles.
	</p>

	<form method="POST">
		<button
			type="submit"
			class="px-5 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
		>
			Download Export
		</button>
	</form>
</div>
