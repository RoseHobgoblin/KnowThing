<script lang="ts">
	import type { ActionData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import { pushError } from '$lib/notifications.svelte'

	let { form }: { form: ActionData } = $props()

	$effect(() => {
		if (form?.error) pushError(form.error)
	})
</script>

<div class="max-w-md mx-auto mt-20 p-6">
	<h1 class="text-2xl font-bold mb-6">Log in</h1>

	{#if form?.error}
		<div class="bg-error-bg border border-error-border text-error-text px-4 py-2 mb-4 text-sm">
			{form.error}
		</div>
	{/if}

	<form method="POST" class="space-y-4">
		<Input
			label="Username"
			name="username"
			type="text"
			required
			value={form?.username ?? ''}
			autocomplete="username"
		/>
		<Input
			label="Password"
			name="password"
			type="password"
			required
			autocomplete="current-password"
		/>
		<button
			type="submit"
			class="
				w-full bg-accent text-surface py-2 font-medium transition-colors
				hover:bg-accent-hover
			"
		>
			Log in
		</button>
	</form>

	<p class="mt-4 text-sm text-secondary">
		Don't have an account? <a href="/auth/register" class="text-accent hover:underline">Register</a>
	</p>
</div>
