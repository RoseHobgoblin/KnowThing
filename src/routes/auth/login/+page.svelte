<script lang="ts">
	import type { PageData } from './$types.js'
	import { superForm } from 'sveltekit-superforms'
	import { zod4Client } from 'sveltekit-superforms/adapters'
	import Input from '$lib/components/ui/Input.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import { pushError } from '$lib/notifications.svelte'
	import { loginSchema } from '$lib/auth/form-schemas.js'

	let { data }: { data: PageData } = $props()

	const { form, errors, message, enhance, submitting } = superForm(data.form, {
		validators: zod4Client(loginSchema),
	})

	$effect(() => {
		if ($message) pushError($message)
	})
</script>

<div class="max-w-md mx-auto mt-20 p-6">
	<h1 class="text-2xl font-bold mb-6">Log in</h1>

	{#if $message}
		<div class="bg-error-bg border border-error-border text-error-text px-4 py-2 mb-4 text-sm">
			{$message}
		</div>
	{/if}

	<form method="POST" use:enhance class="space-y-4">
		<Input
			label="Username"
			name="username"
			type="text"
			required
			bind:value={$form.username}
			error={$errors.username?.[0]}
			autocomplete="username"
		/>
		<Input
			label="Password"
			name="password"
			type="password"
			required
			bind:value={$form.password}
			error={$errors.password?.[0]}
			autocomplete="current-password"
		/>
		<Button type="submit" class="w-full" loading={$submitting} disabled={$submitting}>
			{$submitting ? 'Logging in...' : 'Log in'}
		</Button>
	</form>

	<p class="mt-4 text-sm text-secondary">
		Don't have an account? <a href="/auth/register" class="text-accent hover:underline">Register</a>
	</p>
</div>
