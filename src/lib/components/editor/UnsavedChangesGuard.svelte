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
		const ok = window.confirm(message)
		if (!ok) navigation.cancel()
	})

	$effect(() => {
		if (!when) return

		const handler = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = message
			return message
		}

		window.addEventListener('beforeunload', handler)
		return () => window.removeEventListener('beforeunload', handler)
	})
</script>
