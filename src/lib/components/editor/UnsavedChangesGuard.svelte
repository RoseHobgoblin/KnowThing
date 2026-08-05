<script lang="ts">
	import { beforeNavigate } from '$app/navigation'

	let {
		when = false,
		message = 'You have unsaved changes. Leave this page?',
	}: {
		when?: boolean
		message?: string
	} = $props()

	beforeNavigate((navigation) => {
		if (!when) return

		// Full unload (reload, tab close, external link): cancelling a `leave`
		// navigation makes SvelteKit raise the browser's own dialog. A confirm()
		// here would be ignored by the browser and stack a second prompt.
		if (navigation.type === 'leave') {
			navigation.cancel()
			return
		}

		if (!globalThis.confirm(message)) navigation.cancel()
	})
</script>
