<script lang="ts">
	import type { PageData } from './$types.js'
	import { invalidateAll } from '$app/navigation'
	import { pushSuccess, pushError } from '$lib/notifications.svelte'

	let { data }: { data: PageData } = $props()

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
			pushError('Failed to update role')
		}
	}
</script>

<svelte:head>
	<title>Users — Dashboard — KnowThing</title>
</svelte:head>

<div class="space-y-4">
	<h1 class="text-xl font-bold text-heading">Users</h1>

	<div class="bg-surface border border-border">
		<div class="divide-y divide-border-subtle">
			{#each data.users as user}
				<div class="flex items-center justify-between px-4 py-3">
					<div>
						<span class="font-medium text-body">{user.username}</span>
						<span class="text-xs text-faint ml-2">
							joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
						</span>
					</div>
					<select
						value={user.role}
						onchange={(e) => setRole(user.id, (e.target as HTMLSelectElement).value)}
						class="
							px-3 py-1 border border-border-strong text-sm bg-surface text-body
							focus:outline-none focus:ring-2 focus:ring-accent
						"
					>
						<option value="editor">Editor</option>
						<option value="admin">Admin</option>
					</select>
				</div>
			{/each}
		</div>
	</div>
</div>
