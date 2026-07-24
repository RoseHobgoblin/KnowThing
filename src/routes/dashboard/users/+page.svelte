<script lang="ts">
	import type { PageData } from './$types.js'
	import { invalidateAll } from '$app/navigation'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
	import Badge from '$lib/components/ui/Badge.svelte'
	import { createMutation } from '@tanstack/svelte-query'
	import { api } from '$lib/api'
	import { m } from '$lib/paraglide/messages.js'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	let stablePermissions = $state(normalizePermissions($page.data.permissions))
	const permissions = $derived(stablePermissions)

	$effect(() => {
		if ($page.data.permissions !== undefined) {
			stablePermissions = normalizePermissions($page.data.permissions)
		}
	})
	const currentUser = $derived($page.data.user)
	const isOwner = $derived(currentUser?.role === 'owner')
	const userMutation = createMutation(() => ({
		mutationFn: ({ method, userId, body }: { method: 'PUT' | 'DELETE', userId: number, body?: unknown }) =>
			api(method, `/api/users/${userId}${method === 'PUT' ? '/role' : ''}`, body),
	}))
	const codeMutation = createMutation(() => ({
		mutationFn: (role: string) => api<{ code: string }>('POST', '/api/registration-codes', { role }),
	}))

	async function setRole(userId: number, role: string) {
		try {
			await userMutation.mutateAsync({ method: 'PUT', userId, body: { role } })
			pushSuccess(m.admin_role_updated())
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.admin_role_update_failed())
		}
	}

	async function removeUser(userId: number, username: string) {
		const ok = await confirmDialog.confirm(m.admin_delete_user_title(), m.common_delete_confirm_named({ name: username }), m.common_delete(), m.common_cancel())
		if (!ok) return
		try {
			await userMutation.mutateAsync({ method: 'DELETE', userId })
			pushSuccess(m.admin_user_deleted({ name: username }))
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.admin_user_delete_failed())
		}
	}

	let codeRole = $state('editor')
	let generatedCode = $state('')

	async function generateCode() {
		try {
			const result = await codeMutation.mutateAsync(codeRole)
			generatedCode = result.code
			pushSuccess(m.admin_code_generated())
			await invalidateAll()
		} catch (error) {
			pushError(error instanceof Error ? error.message : m.admin_code_generate_failed())
		}
	}

	function copyCode() {
		navigator.clipboard.writeText(generatedCode)
		pushSuccess(m.admin_copied_to_clipboard())
	}

	const roleOptions = $derived(isOwner ? ['viewer', 'editor', 'admin'] : ['viewer', 'editor'])
</script>

<svelte:head>
	<title>{m.admin_users_page_title()}</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-xl font-bold text-heading">{m.admin_users()}</h1>

	<div class="bg-surface">
		<div class="divide-y divide-border-subtle">
			{#each data.users as user (user.id)}
				<div class="flex items-center justify-between px-4 py-3">
					<div class="flex items-center gap-2">
						<span class="font-medium text-body">{user.username}</span>
						{#if user.role === 'owner'}
							<Badge variant="accent">{m.admin_owner()}</Badge>
						{/if}
						<span class="text-xs text-secondary">
							{m.admin_joined({ date: new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) })}
						</span>
					</div>
					<div class="flex items-center gap-2">
						{#if user.role === 'owner'}
							<span class="text-xs text-secondary">{m.admin_owner()}</span>
						{:else}
							<Select
								type="single"
								value={user.role}
								onValueChange={(v: string) => { if (v !== user.role) setRole(user.id, v) }}
								items={roleOptions.map(r => ({ value: r, label: r }))}
								size="sm"
							/>
							{#if user.id !== currentUser?.id}
								<button onclick={() => removeUser(user.id, user.username)} class="text-xs text-error transition-colors hover:text-error-hover">{m.common_delete()}</button>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Registration codes -->
		<section class="bg-surface p-5 space-y-4">
			<h2 class="text-sm font-semibold text-heading">{m.admin_registration_codes()}</h2>
			<p class="text-xs text-secondary">{m.admin_registration_codes_desc()}</p>
			<p class="text-xs text-secondary">{m.admin_codes_shown_once()}</p>
			{#if permissions.canGenerateInviteCodes && !isOwner}
				<p class="text-xs text-secondary">{m.admin_owner_required_admin_codes()}</p>
			{/if}

		<div class="flex gap-3 items-end">
			<Select
				type="single"
				label={m.auth_role()}
				bind:value={codeRole}
				items={roleOptions.map(r => ({ value: r, label: r }))}
			/>
			<Button onclick={generateCode} loading={codeMutation.isPending}>
				{codeMutation.isPending ? m.admin_generating() : m.admin_generate_code()}
			</Button>
		</div>

		{#if generatedCode}
			<div class="flex items-center gap-2 bg-raised p-3">
				<code class="text-body font-mono text-lg flex-1">{generatedCode}</code>
				<button onclick={copyCode} class="text-xs text-link hover:text-link-hover">{m.admin_copy()}</button>
			</div>
		{/if}

		{#if (data.codes as any[]).length > 0}
			<div class="border-t border-border-subtle pt-3 mt-3">
				<span class="text-xs text-secondary uppercase tracking-wider">{m.admin_recent_codes()}</span>
				<div class="mt-2 space-y-1">
					{#each data.codes as code (code.id)}
						<div class="flex items-center justify-between text-xs py-1">
							<code class="text-secondary font-mono">{code.code}</code>
							<div class="flex items-center gap-2">
								<span class="text-secondary">{code.role}</span>
								{#if code.isOwnerOnlyRole}
									<span class="text-secondary">{m.admin_owner_only()}</span>
								{/if}
								{#if code.usedBy}
									<span class="text-accent">{m.admin_code_used()}</span>
								{:else if code.expiresAt && new Date(code.expiresAt) < new Date()}
									<span class="text-error">{m.admin_code_expired()}</span>
								{:else}
									<span class="text-body">{m.admin_code_available()}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>
</div>

<ConfirmDialog bind:this={confirmDialog} />
