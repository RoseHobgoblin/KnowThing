<script lang="ts">
	import type { PageData } from './$types.js'
	import { invalidateAll } from '$app/navigation'
	import { page } from '$app/stores'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'
	import Button from '$lib/components/ui/Button.svelte'
	import Select from '$lib/components/ui/Select.svelte'
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'

	let { data }: { data: PageData } = $props()
	let confirmDialog: ReturnType<typeof ConfirmDialog>

	const currentUser = $derived($page.data.user)
	const isOwner = $derived(currentUser?.role === 'owner')

	async function setRole(userId: number, role: string) {
		const res = await fetch(`/api/users/${userId}/role`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role }),
		})
		if (res.ok) {
			pushSuccess('Role updated')
			invalidateAll()
		} else {
			const err = await res.json().catch(() => null)
			pushError(err?.error || 'Failed to update role')
		}
	}

	async function removeUser(userId: number, username: string) {
		const ok = await confirmDialog.confirm('Delete user', `Delete "${username}"? This cannot be undone.`, 'Delete', 'Cancel')
		if (!ok) return
		const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
		if (res.ok) {
			pushSuccess(`"${username}" deleted`)
			invalidateAll()
		} else {
			pushError('Failed to delete user')
		}
	}

	let codeRole = $state('editor')
	let generating = $state(false)
	let generatedCode = $state('')

	async function generateCode() {
		generating = true
		try {
			const res = await fetch('/api/registration-codes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: codeRole }),
			})
			if (res.ok) {
				const result = await res.json()
				generatedCode = result.code
				pushSuccess('Code generated')
				invalidateAll()
			} else {
				pushError('Failed to generate code')
			}
		} finally {
			generating = false
		}
	}

	function copyCode() {
		navigator.clipboard.writeText(generatedCode)
		pushSuccess('Copied to clipboard')
	}

	const roleOptions = $derived(isOwner ? ['viewer', 'editor', 'admin'] : ['viewer', 'editor'])
</script>

<svelte:head>
	<title>Users — Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-xl font-bold text-heading">Users</h1>

	<div class="bg-surface border border-border">
		<div class="divide-y divide-border-subtle">
			{#each data.users as user (user.id)}
				<div class="flex items-center justify-between px-4 py-3">
					<div class="flex items-center gap-2">
						<span class="font-medium text-body">{user.username}</span>
						{#if user.role === 'owner'}
							<span class="text-[10px] px-1.5 py-0.5 bg-accent text-surface font-semibold uppercase tracking-wider">Owner</span>
						{/if}
						<span class="text-xs text-faint">
							joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
						</span>
					</div>
					<div class="flex items-center gap-2">
						{#if user.role === 'owner'}
							<span class="text-xs text-faint">Owner</span>
						{:else}
							<Select
								type="single"
								value={user.role}
								onValueChange={(v: string) => { if (v !== user.role) setRole(user.id, v) }}
								items={roleOptions.map(r => ({ value: r, label: r }))}
								size="sm"
							/>
							{#if user.id !== currentUser?.id}
								<button onclick={() => removeUser(user.id, user.username)} class="text-xs text-error transition-colors hover:text-error-hover">Delete</button>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Registration codes -->
	<section class="bg-surface border border-border p-5 space-y-4">
		<h2 class="text-sm font-semibold text-heading">Registration Codes</h2>
		<p class="text-xs text-faint">Generate invite codes for new users. Each code can be used once.</p>

		<div class="flex gap-3 items-end">
			<Select
				type="single"
				label="Role"
				bind:value={codeRole}
				items={roleOptions.map(r => ({ value: r, label: r }))}
			/>
			<Button onclick={generateCode} loading={generating}>
				{generating ? 'Generating...' : 'Generate Code'}
			</Button>
		</div>

		{#if generatedCode}
			<div class="flex items-center gap-2 bg-raised border border-border-subtle p-3">
				<code class="text-body font-mono text-lg flex-1">{generatedCode}</code>
				<button onclick={copyCode} class="text-xs text-link hover:text-link-hover">Copy</button>
			</div>
		{/if}

		{#if (data.codes as any[]).length > 0}
			<div class="border-t border-border-subtle pt-3 mt-3">
				<span class="text-xs text-faint uppercase tracking-wider">Recent Codes</span>
				<div class="mt-2 space-y-1">
					{#each data.codes as code (code.id)}
						<div class="flex items-center justify-between text-xs py-1">
							<code class="text-secondary font-mono">{code.code}</code>
							<div class="flex items-center gap-2">
								<span class="text-faint">{code.role}</span>
								{#if code.usedBy}
									<span class="text-accent">used</span>
								{:else if code.expiresAt && new Date(code.expiresAt) < new Date()}
									<span class="text-error">expired</span>
								{:else}
									<span class="text-body">available</span>
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
