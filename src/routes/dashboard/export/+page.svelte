<script lang="ts">
	import type { PageData, ActionData } from './$types.js'

	import Button from '$lib/components/ui/Button.svelte'
	import { m } from '$lib/paraglide/messages.js'

	let { data, form }: { data: PageData, form: ActionData } = $props()

	function downloadExport() {
		if (!form?.download) return
		const blob = new Blob([form.download], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = form.filename || 'knowthing-export.json'
		a.click()
		URL.revokeObjectURL(url)
	}

	$effect(() => {
		if (form?.download) downloadExport()
	})
</script>

<svelte:head>
	<title>{m.dash_nav_export()} — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm p-6">
	<h1 class="text-xl font-bold text-heading mb-2">{m.dash_export_heading()}</h1>
	<p class="text-sm text-dim mb-6">
		{m.dash_export_desc({ count: data.pageCount })}
	</p>

	<form method="POST">
		<Button type="submit" size="lg">
			{m.dash_export_download_button()}
		</Button>
	</form>
</div>
