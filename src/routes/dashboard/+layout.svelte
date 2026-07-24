<script lang="ts">
	import { untrack } from 'svelte'
	import type { Snippet } from 'svelte'
	import type { LayoutData } from './$types.js'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import { m } from '$lib/paraglide/messages.js'
	import Wrench from 'phosphor-svelte/lib/Wrench'
	import Users from 'phosphor-svelte/lib/Users'
	import Image from 'phosphor-svelte/lib/Image'
	import Export from 'phosphor-svelte/lib/Export'
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
	import FileMagnifyingGlass from 'phosphor-svelte/lib/FileMagnifyingGlass'
	import LinkBreak from 'phosphor-svelte/lib/LinkBreak'

	let { children, data }: { children: Snippet, data: LayoutData } = $props()
	let stablePermissions = $state(untrack(() => normalizePermissions(data.permissions)))

	const currentPath = $derived($page.url.pathname)
	const permissions = $derived(stablePermissions)

	$effect(() => {
		if (data.permissions !== undefined) {
			stablePermissions = normalizePermissions(data.permissions)
		}
	})

	const linkClass = 'flex items-center gap-2 px-3 py-1.5 text-xs transition-colors'
	const activeClass = 'text-accent font-medium bg-raised'
	const inactiveClass = 'text-secondary hover:text-heading hover:bg-raised'

	function isActive(href: string): boolean {
		return currentPath.startsWith(href)
	}
</script>

<div class="w-full space-y-4">
	<!-- Admin sub-nav -->
	<nav class="bg-surface p-2 flex flex-wrap gap-1">
		<a href="/dashboard/recent" class="{linkClass} {isActive('/dashboard/recent') ? activeClass : inactiveClass}"><ClockCounterClockwise size={14} weight="fill" />{m.dash_nav_recent()}</a>
		<a href="/dashboard/media" class="{linkClass} {isActive('/dashboard/media') ? activeClass : inactiveClass}"><Image size={14} weight="fill" />{m.dash_nav_media()}</a>
		<a href="/dashboard/wanted" class="{linkClass} {isActive('/dashboard/wanted') ? activeClass : inactiveClass}"><FileMagnifyingGlass size={14} weight="fill" />{m.dash_nav_wanted()}</a>
		<a href="/dashboard/orphans" class="{linkClass} {isActive('/dashboard/orphans') ? activeClass : inactiveClass}"><LinkBreak size={14} weight="fill" />{m.dash_nav_orphans()}</a>
		{#if permissions.canManageSettings || permissions.canManageUsers}
			<span class="border-l border-border-subtle mx-1"></span>
			{#if permissions.canManageSettings}
				<a href="/dashboard/settings" class="{linkClass} {isActive('/dashboard/settings') ? activeClass : inactiveClass}"><Wrench size={14} weight="fill" />{m.nav_settings()}</a>
				<a href="/dashboard/export" class="{linkClass} {isActive('/dashboard/export') ? activeClass : inactiveClass}"><Export size={14} weight="fill" />{m.dash_nav_export()}</a>
			{/if}
			{#if permissions.canManageUsers}
				<a href="/dashboard/users" class="{linkClass} {isActive('/dashboard/users') ? activeClass : inactiveClass}"><Users size={14} weight="fill" />{m.dash_nav_users()}</a>
			{/if}
		{/if}
	</nav>

	{@render children()}
</div>
