<script lang="ts">
	import type { PageData } from './$types.js'
	import { superForm } from 'sveltekit-superforms'
	import { zod4Client } from 'sveltekit-superforms/adapters'
	import Input from '$lib/components/ui/Input.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import { pushError } from '$lib/notifications.svelte'
	import { registerSchema } from '$lib/auth/form-schemas.js'

	let { data }: { data: PageData } = $props()

	const { form, errors, message, enhance, submitting } = superForm(data.form, {
		validators: zod4Client(registerSchema),
	})

	$effect(() => {
		if ($message) pushError($message)
	})
</script>

<div class="max-w-md mx-auto mt-20 p-6">
	<h1 class="text-2xl font-bold mb-2">Create account</h1>
	{#if !data.requireCode}
		<p class="text-sm text-accent mb-6">First user — you'll be the site owner.</p>
	{:else}
		<p class="text-sm text-dim mb-6">You need a registration code to create an account.</p>
	{/if}

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
			minlength={3}
			bind:value={$form.username}
			error={$errors.username?.[0]}
			autocomplete="username"
		/>
		<Input
			label="Password"
			name="password"
			type="password"
			required
			minlength={8}
			bind:value={$form.password}
			error={$errors.password?.[0]}
			autocomplete="new-password"
		/>
		<Input
			label="Confirm password"
			name="confirm"
			type="password"
			required
			bind:value={$form.confirm}
			error={$errors.confirm?.[0]}
			autocomplete="new-password"
		/>
		{#if data.requireCode}
			<Input
				label="Registration code"
				name="code"
				type="text"
				required
				bind:value={$form.code}
				error={$errors.code?.[0]}
				placeholder="Enter your invite code"
				autocomplete="off"
			/>
		{/if}
		<Button type="submit" class="w-full" loading={$submitting} disabled={$submitting}>
			{$submitting ? 'Registering...' : 'Register'}
		</Button>
	</form>

	<p class="mt-4 text-sm text-secondary">
		Already have an account? <a href="/auth/login" class="text-accent hover:underline">Log in</a>
	</p>
</div>
