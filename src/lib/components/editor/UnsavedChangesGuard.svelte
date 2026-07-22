<script lang="ts">
	import { beforeNavigate } from '$app/navigation'
	import { useEventListener } from 'runed'

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

	// Target getter returns undefined while `when` is false, so the listener is
	// only attached when there are unsaved changes (and torn down otherwise).
	useEventListener(
		() => (when ? window : undefined),
		'beforeunload',
		(event) => {
			event.preventDefault()
			event.returnValue = message
		},
	)
</script>
