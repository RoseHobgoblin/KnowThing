<script lang="ts">
	import type { ActionData, PageData } from './$types.js'
	import { enhance } from '$app/forms'
	import Input from '$lib/components/ui/Input.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import { pushError } from '$lib/notifications.svelte'
	import { m } from '$lib/paraglide/messages.js'

	let { form, data }: { form: ActionData, data: PageData } = $props()
	let submitting = $state(false)

	$effect(() => {
		if (form?.error) pushError(form.error)
	})
</script>

<div class="max-w-md mx-auto mt-20 p-6">
	<h1 class="text-2xl font-bold mb-2">{m.auth_create_account()}</h1>
	{#if !data.requireCode}
		<p class="text-sm text-accent mb-6">{m.home_first_user_notice()}</p>
	{:else}
		<p class="text-sm text-dim mb-6">{m.auth_need_code()}</p>
	{/if}

	{#if form?.error}
		<div class="bg-error-bg border border-error-border text-error-text px-4 py-2 mb-4 text-sm">
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
			minlength={3}
			value={form?.username ?? ''}
			autocomplete="username"
		/>
		<Input
			label={m.auth_password()}
			name="password"
			type="password"
			required
			minlength={8}
			autocomplete="new-password"
		/>
		<Input
			label={m.auth_confirm_password()}
			name="confirm"
			type="password"
			required
			autocomplete="new-password"
		/>
		{#if data.requireCode}
			<Input
				label={m.auth_registration_code()}
				name="code"
				type="text"
				required
				placeholder={m.auth_enter_invite_code()}
				autocomplete="off"
			/>
		{/if}
		<Button type="submit" class="w-full" loading={submitting} disabled={submitting}>
			{submitting ? m.auth_registering() : m.auth_register()}
		</Button>
	</form>

	<p class="mt-4 text-sm text-secondary">
		{m.auth_have_account()} <a href="/auth/login" class="text-accent hover:underline">{m.auth_log_in()}</a>
	</p>
</div>
