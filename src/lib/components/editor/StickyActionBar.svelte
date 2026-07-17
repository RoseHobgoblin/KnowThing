<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte'
	import SaveStatusBadge from '$lib/components/editor/SaveStatusBadge.svelte'

	let {
		dirty = false,
		saving = false,
		error = '',
		savedAt = null,
		saveLabel = 'Save',
		savingLabel = 'Saving...',
		saveType = 'button',
		onsave,
		onsaveandexit,
		ondiscard,
		discardLabel = 'Discard changes',
		disableSave = false,
		disableDiscard = false,
		cancelHref,
		cancelLabel = 'Cancel',
	}: {
		dirty?: boolean
		saving?: boolean
		error?: string
		savedAt?: Date | null
		saveLabel?: string
		savingLabel?: string
		saveType?: 'button' | 'submit'
		onsave?: () => void
		onsaveandexit?: () => void
		ondiscard?: () => void
		discardLabel?: string
		disableSave?: boolean
		disableDiscard?: boolean
		cancelHref?: string
		cancelLabel?: string
	} = $props()
</script>

<div class="sticky bottom-0 z-20 bg-surface/95 backdrop-blur px-4 py-3">
	<div class="flex flex-col gap-3 md:flex-row md:items-center">
		<div class="flex items-center gap-2">
			<SaveStatusBadge {dirty} {saving} {error} {savedAt} />
			{#if dirty}
				<span class="text-xs text-secondary">Review or discard local changes before leaving.</span>
			{/if}
		</div>
		<div class="flex gap-2 md:ml-auto">
			{#if cancelHref}
				<Button variant="secondary" href={cancelHref}>
					{cancelLabel}
				</Button>
			{/if}
			{#if ondiscard}
				<Button variant="secondary" onclick={ondiscard} disabled={disableDiscard || saving}>
					{discardLabel}
				</Button>
			{/if}
			{#if saveType === 'submit'}
				<Button type="submit" disabled={disableSave || saving}>
					{saving ? savingLabel : saveLabel}
				</Button>
			{:else}
				<Button onclick={onsave} disabled={disableSave || saving} loading={saving}>
					{saving ? savingLabel : saveLabel}
				</Button>
				{#if onsaveandexit}
					<Button variant="secondary" onclick={onsaveandexit} disabled={disableSave || saving}>
						Save & Exit
					</Button>
				{/if}
			{/if}
		</div>
	</div>
</div>
