<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { accountBreadcrumbs } from '$lib/utils/breadcrumbs.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	let currentPassword = $state('')
	let newPassword = $state('')
	let confirmPassword = $state('')
	const accountMutation = createMutation(() => ({
		mutationFn: ({ method, body }: { method: 'PUT' | 'DELETE', body?: unknown }) =>
			api(method, '/api/account', body),
	}))

	async function handleChangePassword() {
		if (newPassword !== confirmPassword) {
			pushError(m.auth_passwords_no_match())
			return
		}
		try {
			await accountMutation.mutateAsync({ method: 'PUT', body: { currentPassword, newPassword } })
			pushSuccess(m.auth_password_changed())
			goto('/auth/login')
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.auth_change_password_failed())
		}
	}

	async function handleDeleteAccount() {
		const ok = await confirmDialog.confirm(
			m.auth_delete_account_title(),
			m.auth_delete_account_confirm(),
			m.auth_delete_account_ok(),
			m.common_cancel(),
		)
		if (!ok) return

		try {
			await accountMutation.mutateAsync({ method: 'DELETE' })
			pushSuccess(m.auth_account_deleted())
			goto('/')
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.auth_delete_account_failed())
		}
	}
</script>

<svelte:head>
	<title>{m.auth_account()} — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={accountBreadcrumbs()}
	title={m.auth_account()}
>
	<!-- Info -->
	<section class="bg-raised p-4 mb-6">
		<div class="flex items-center gap-3 text-sm">
			<span class="text-secondary">{m.auth_username()}</span>
			<span class="text-body font-medium">{data.username}</span>
		</div>
		<div class="flex items-center gap-3 text-sm mt-1">
			<span class="text-secondary">{m.auth_role()}</span>
			<span class="text-body font-medium capitalize">{data.role}</span>
		</div>
	</section>

	<!-- Change password -->
	<section class="mb-6">
		<h2 class="text-sm font-semibold text-heading mb-3">{m.auth_change_password()}</h2>
		<div class="space-y-3 max-w-md">
			<Input
				label={m.auth_current_password()}
				type="password"
				bind:value={currentPassword}
				autocomplete="current-password"
			/>
			<Input
				label={m.auth_new_password()}
				type="password"
				bind:value={newPassword}
				autocomplete="new-password"
			/>
			<Input
				label={m.auth_confirm_new_password()}
				type="password"
				bind:value={confirmPassword}
				autocomplete="new-password"
			/>
			<Button
				onclick={handleChangePassword}
				disabled={!currentPassword || !newPassword || !confirmPassword}
				loading={accountMutation.isPending}
			>
				{accountMutation.isPending ? m.auth_changing() : m.auth_change_password()}
			</Button>
		</div>
	</section>

	<!-- Delete account -->
	{#if data.role !== 'owner'}
		<section class="border-t border-border-subtle pt-6">
			<h2 class="text-sm font-semibold text-error mb-2">{m.auth_danger_zone()}</h2>
			<p class="text-xs text-dim mb-3">{m.auth_delete_account_desc()}</p>
			<Button variant="danger" onclick={handleDeleteAccount}>
				{m.auth_delete_account()}
			</Button>
		</section>
	{/if}
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
