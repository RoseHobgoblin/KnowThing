<script lang="ts">
	import type { ActionData, PageData } from './$types.js'
	import { enhance } from '$app/forms'
	import Input from '$lib/components/ui/Input.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import { pushError } from '$lib/notifications.svelte'

	let { form, data }: { form: ActionData, data: PageData } = $props()
	let submitting = $state(false)

	$effect(() => {
		if (form?.error) pushError(form.error)
	})
</script>

<div class="max-w-md mx-auto mt-20 p-6">
	<h1 class="text-2xl font-bold mb-2">Create account</h1>
	{#if !data.requireCode}
		<p class="text-sm text-accent mb-6">First user — you'll be the site owner.</p>
	{:else}
		<p class="text-sm text-dim mb-6">You need a registration code to create an account.</p>
	{/if}

	{#if form?.error}
		<div class="bg-error-bg border border-error-border text-error-text px-4 py-2 mb-4 text-sm">
			{form.error}
		</div>
	{/if}

	<form method="POST" use:enhance={() => { submitting = true; return async ({ update }) => { submitting = false; await update() } }} class="space-y-4">
		<Input
			label="Username"
			name="username"
			type="text"
			required
			minlength={3}
			value={form?.username ?? ''}
			autocomplete="username"
		/>
		<Input
			label="Password"
			name="password"
			type="password"
			required
			minlength={8}
			autocomplete="new-password"
		/>
		<Input
			label="Confirm password"
			name="confirm"
			type="password"
			required
			autocomplete="new-password"
		/>
		{#if data.requireCode}
			<Input
				label="Registration code"
				name="code"
				type="text"
				required
				placeholder="Enter your invite code"
				autocomplete="off"
			/>
		{/if}
		<Button type="submit" class="w-full" loading={submitting} disabled={submitting}>
			{submitting ? 'Registering...' : 'Register'}
		</Button>
	</form>

	<p class="mt-4 text-sm text-secondary">
		Already have an account? <a href="/auth/login" class="text-accent hover:underline">Log in</a>
	</p>
</div>
