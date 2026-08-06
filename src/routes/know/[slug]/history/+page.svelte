<script lang="ts">
	import type { PageData } from './$types.js'
	import { invalidateAll } from '$app/navigation'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()

	let selectedOld = $state<number | null>(null)
	let selectedNew = $state<number | null>(null)
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const restoreMutation = createMutation(() => ({
		mutationFn: (revisionId: number) =>
			api('POST', `/api/pages/${encodeURIComponent(data.slug)}/history/${revisionId}?domain=know`),
	}))

	function compareDiff() {
		if (selectedOld && selectedNew) {
			globalThis.location.href = `/know/${data.slug}/history?diff=${selectedNew}&against=${selectedOld}`
		}
	}

	async function restore(revisionId: number, createdAt: string | Date) {
		const date = new Date(createdAt).toLocaleString()
		const ok = await confirmDialog.confirm(
			m.know_restore_revision(),
			m.know_restore_confirm({ date }),
			m.know_restore(),
			m.common_cancel(),
		)
		if (!ok) return
		try {
			await restoreMutation.mutateAsync(revisionId)
			pushSuccess(m.know_restored_toast({ date }))
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.know_restore_failed())
		}
	}
</script>

<ConfirmDialog bind:this={confirmDialog} />

<svelte:head>
	<title>{m.know_history_title({ name: data.title })} — KnowThing</title>
</svelte:head>

<div class="bg-surface shadow-sm">
	<div class="flex items-center justify-between border-b border-border-subtle px-6 py-4">
		<div>
			<h1 class="text-xl font-bold text-heading">{m.know_revision_history()}</h1>
			<a href="/know/{data.slug}" class="text-sm text-link hover:text-link-hover">{data.title}</a>
		</div>
		{#if selectedOld && selectedNew}
			<button onclick={compareDiff} class="bg-accent px-4 py-1.5 text-sm text-surface transition-colors hover:bg-accent-hover">
				{m.know_compare_selected()}
			</button>
		{/if}
	</div>

	{#if data.diff}
		<!-- Diff view -->
		<div class="border-b border-border bg-page px-6 py-4">
			<div class="mb-3 flex items-center justify-between text-xs text-dim">
				<span>{m.know_older({ name: data.diffOldLabel })}</span>
				<span>{m.know_newer({ name: data.diffNewLabel })}</span>
			</div>
			<div class="overflow-x-auto font-mono text-xs/relaxed">
				{#each data.diff as part, index (index)}
					{#if part.added}
						<div class="border-l-4 border-diff-add-border bg-diff-add-bg px-2 py-0.5 text-diff-add-text">{part.value}</div>
					{:else if part.removed}
						<div class="border-l-4 border-diff-rm-border bg-diff-rm-bg px-2 py-0.5 text-diff-rm-text">{part.value}</div>
					{:else}
						<div class="px-2 py-0.5 text-secondary">{part.value}</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	{#if data.history.length === 0}
		<div class="p-6 text-center text-dim">{m.know_no_revisions()}</div>
	{:else}
		<div class="divide-y divide-border-subtle">
			{#each data.history as rev, index (rev.id)}
				<div class="flex items-center gap-4 px-6 py-3">
					<div class="flex shrink-0 gap-2">
						<label class="text-xs text-secondary">
							<input type="radio" name="old" value={rev.id} bind:group={selectedOld} class="accent-accent" />
						</label>
						<label class="text-xs text-secondary">
							<input type="radio" name="new" value={rev.id} bind:group={selectedNew} class="accent-accent" />
						</label>
					</div>
					<div class="min-w-0 flex-1 text-sm">
						<span class="text-secondary">
							{new Date(rev.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
						</span>
						<span class="mx-1.5 text-secondary">&middot;</span>
						<span class="text-secondary">{rev.username || m.know_unknown_user()}</span>
						<span class="mx-1.5 text-secondary">&middot;</span>
						<span class="text-secondary">{(rev.sizeBytes / 1024).toFixed(1)} KB</span>
						{#if rev.editSummary}
							<span class="mx-1.5 text-secondary">&middot;</span>
							<span class="text-dim italic">{rev.editSummary}</span>
						{/if}
					</div>
					<!-- index 0 is the live content; restoring it would only add a no-op revision. -->
					{#if index > 0}
						<button
							onclick={() => restore(rev.id, rev.createdAt)}
							disabled={restoreMutation.isPending}
							class="shrink-0 border border-border-subtle px-3 py-1 text-xs text-secondary transition-colors hover:bg-raised hover:text-heading disabled:opacity-50"
						>
							{m.know_restore()}
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
