<script lang="ts" module>
	export type ConfirmDialogRef = {
		confirm: (title?: string, text?: string, buttonText?: string, cancelText?: string | null) => Promise<boolean>
	}
</script>

<script lang="ts">
	import Dialog from './Dialog.svelte'

	let title = $state('')
	let text = $state<string | undefined>(undefined)
	let buttonText = $state<string | null>('Confirm')
	let cancelText = $state<string | null>('Cancel')
	let isOpen = $state(false)
	let confirming = $state(false)
	let resolvePromise: ((value: boolean) => void) | null = null

	export function confirm(
		popupTitle?: string,
		_text?: string,
		_buttonText?: string,
		_cancelText?: string | null,
	): Promise<boolean> {
		title = popupTitle ?? ''
		text = _text
		buttonText = _buttonText === undefined ? 'Confirm' : _buttonText
		cancelText = _cancelText === undefined ? 'Cancel' : _cancelText
		confirming = false
		return new Promise((resolve) => {
			resolvePromise = resolve
			isOpen = true
		})
	}

	async function handleComplete() {
		if (resolvePromise) {
			confirming = true
			await new Promise(resolve => setTimeout(resolve, 150))
			resolvePromise(true)
			resolvePromise = null
			isOpen = false
		}
	}

	function handleClose() {
		if (resolvePromise) {
			resolvePromise(false)
			resolvePromise = null
			isOpen = false
		}
	}
</script>

<Dialog bind:open={isOpen} {title} onclose={handleClose}>
	<div class="flex flex-col gap-4">
		{#if text}
			<p class="text-sm text-secondary">{text}</p>
		{/if}
		<div class="flex justify-end gap-3">
			{#if cancelText}
				<button
					onclick={handleClose}
					disabled={confirming}
					class="
						px-4 py-2 text-sm text-secondary transition-colors
						hover:bg-raised disabled:opacity-50
					"
				>
					{cancelText}
				</button>
			{/if}
			{#if buttonText}
				<button
					onclick={handleComplete}
					disabled={confirming}
					class="
						px-4 py-2 text-sm bg-accent text-surface font-medium transition-colors
						hover:bg-accent-hover disabled:opacity-50
					"
				>
					{confirming ? 'Confirming...' : buttonText}
				</button>
			{/if}
		</div>
	</div>
</Dialog>
