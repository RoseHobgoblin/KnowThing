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
			pushError('Passwords do not match')
			return
		}
		try {
			await accountMutation.mutateAsync({ method: 'PUT', body: { currentPassword, newPassword } })
			pushSuccess('Password changed. Please log in again.')
			goto('/auth/login')
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Failed to change password')
		}
	}

	async function handleDeleteAccount() {
		const ok = await confirmDialog.confirm(
			'Delete account',
			'This will permanently delete your account and all your sessions. This cannot be undone.',
			'Delete my account',
			'Cancel',
		)
		if (!ok) return

		try {
			await accountMutation.mutateAsync({ method: 'DELETE' })
			pushSuccess('Account deleted')
			goto('/')
		} catch (error) {
			pushError(error instanceof Error ? error.message : 'Failed to delete account')
		}
	}
</script>

<svelte:head>
	<title>Account — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={accountBreadcrumbs()}
	title="Account"
>
	<!-- Info -->
	<section class="bg-raised p-4 mb-6">
		<div class="flex items-center gap-3 text-sm">
			<span class="text-secondary">Username</span>
			<span class="text-body font-medium">{data.username}</span>
		</div>
		<div class="flex items-center gap-3 text-sm mt-1">
			<span class="text-secondary">Role</span>
			<span class="text-body font-medium capitalize">{data.role}</span>
		</div>
	</section>

	<!-- Change password -->
	<section class="mb-6">
		<h2 class="text-sm font-semibold text-heading mb-3">Change Password</h2>
		<div class="space-y-3 max-w-md">
			<Input
				label="Current password"
				type="password"
				bind:value={currentPassword}
				autocomplete="current-password"
			/>
			<Input
				label="New password"
				type="password"
				bind:value={newPassword}
				autocomplete="new-password"
			/>
			<Input
				label="Confirm new password"
				type="password"
				bind:value={confirmPassword}
				autocomplete="new-password"
			/>
			<Button
				onclick={handleChangePassword}
				disabled={!currentPassword || !newPassword || !confirmPassword}
				loading={accountMutation.isPending}
			>
				{accountMutation.isPending ? 'Changing...' : 'Change Password'}
			</Button>
		</div>
	</section>

	<!-- Delete account -->
	{#if data.role !== 'owner'}
		<section class="border-t border-border-subtle pt-6">
			<h2 class="text-sm font-semibold text-error mb-2">Danger Zone</h2>
			<p class="text-xs text-dim mb-3">Permanently delete your account. This cannot be undone.</p>
			<Button variant="danger" onclick={handleDeleteAccount}>
				Delete Account
			</Button>
		</section>
	{/if}
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
