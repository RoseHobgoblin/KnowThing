<script lang="ts">
	import type { ActionData } from './$types.js'
	import { enhance } from '$app/forms'
	import Input from '$lib/components/ui/Input.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import { pushError } from '$lib/notifications.svelte'
	import { m } from '$lib/paraglide/messages.js'

	let { form }: { form: ActionData } = $props()
	let submitting = $state(false)

	$effect(() => {
		if (form?.error) pushError(form.error)
	})
</script>

<div class="mx-auto mt-20 max-w-md p-6">
	<h1 class="mb-6 text-2xl font-bold">{m.auth_log_in()}</h1>

	{#if form?.error}
		<div class="mb-4 border border-error-border bg-error-bg px-4 py-2 text-sm text-error-text">
			{form.error}
		</div>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			submitting = true
			return async ({ update }) => {
				await update()
				submitting = false
			}
		}}
		class="space-y-4"
	>
		<Input
			label={m.auth_username()}
			name="username"
			type="text"
			required
			value={form?.username ?? ''}
			autocomplete="username"
		/>
		<Input
			label={m.auth_password()}
			name="password"
			type="password"
			required
			autocomplete="current-password"
		/>
		<Button type="submit" class="w-full" loading={submitting} disabled={submitting}>
			{submitting ? m.auth_logging_in() : m.auth_log_in()}
		</Button>
	</form>

	<p class="mt-4 text-sm text-secondary">
		{m.auth_no_account()} <a href="/auth/register" class="text-accent hover:underline">{m.auth_register()}</a>
	</p>
</div>
