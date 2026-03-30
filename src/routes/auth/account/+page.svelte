<script lang="ts">
	import type { PageData } from './$types.js'
	import Input from '$lib/components/ui/Input.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import ArticleShell from '$lib/components/ArticleShell.svelte'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import { goto } from '$app/navigation'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	let currentPassword = $state('')
	let newPassword = $state('')
	let confirmPassword = $state('')
	let changingPassword = $state(false)

	async function handleChangePassword() {
		if (newPassword !== confirmPassword) {
			pushError('Passwords do not match')
			return
		}
		changingPassword = true
		try {
			const res = await fetch('/api/account', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword }),
			})
			if (res.ok) {
				pushSuccess('Password changed. Please log in again.')
				goto('/auth/login')
			} else {
				const err = await res.json().catch(() => null)
				pushError(err?.error || 'Failed to change password')
			}
		} finally {
			changingPassword = false
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

		const res = await fetch('/api/account', { method: 'DELETE' })
		if (res.ok) {
			pushSuccess('Account deleted')
			goto('/')
		} else {
			const err = await res.json().catch(() => null)
			pushError(err?.error || 'Failed to delete account')
		}
	}
</script>

<svelte:head>
	<title>Account — KnowThing</title>
</svelte:head>

<ArticleShell
	breadcrumbs={[{ label: 'Account' }]}
	title="Account"
>
	<!-- Info -->
	<section class="bg-raised border border-border-subtle p-4 mb-6">
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
			<button
				onclick={handleChangePassword}
				disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
				class="px-4 py-2 bg-accent text-surface text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50"
			>
				{changingPassword ? 'Changing...' : 'Change Password'}
			</button>
		</div>
	</section>

	<!-- Delete account -->
	{#if data.role !== 'owner'}
		<section class="border-t border-border-subtle pt-6">
			<h2 class="text-sm font-semibold text-error mb-2">Danger Zone</h2>
			<p class="text-xs text-dim mb-3">Permanently delete your account. This cannot be undone.</p>
			<button
				onclick={handleDeleteAccount}
				class="px-4 py-2 bg-error text-white text-sm font-medium transition-opacity hover:opacity-90"
			>
				Delete Account
			</button>
		</section>
	{/if}
</ArticleShell>

<ConfirmDialog bind:this={confirmDialog} />
