<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { LayoutData } from './$types.js'
	import { page } from '$app/stores'
	import Wrench from 'phosphor-svelte/lib/Wrench'
	import Users from 'phosphor-svelte/lib/Users'
	import Image from 'phosphor-svelte/lib/Image'
	import Export from 'phosphor-svelte/lib/Export'
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
	import FileMagnifyingGlass from 'phosphor-svelte/lib/FileMagnifyingGlass'
	import LinkBreak from 'phosphor-svelte/lib/LinkBreak'

	let { children, data }: { children: Snippet, data: LayoutData } = $props()

	const currentPath = $derived($page.url.pathname)
	const permissions = $derived($page.data.permissions)

	const linkClass = 'flex items-center gap-2 px-3 py-1.5 text-xs transition-colors'
	const activeClass = 'text-accent font-medium bg-raised'
	const inactiveClass = 'text-secondary hover:text-heading hover:bg-raised'

	function isActive(href: string): boolean {
		return currentPath.startsWith(href)
	}
</script>

<div class="w-full space-y-4">
	<!-- Admin sub-nav -->
	<nav class="bg-surface border border-border p-2 flex flex-wrap gap-1">
		<a href="/dashboard/recent" class="{linkClass} {isActive('/dashboard/recent') ? activeClass : inactiveClass}"><ClockCounterClockwise size={14} weight="fill" />Recent</a>
		<a href="/dashboard/media" class="{linkClass} {isActive('/dashboard/media') ? activeClass : inactiveClass}"><Image size={14} weight="fill" />Media</a>
		<a href="/dashboard/wanted" class="{linkClass} {isActive('/dashboard/wanted') ? activeClass : inactiveClass}"><FileMagnifyingGlass size={14} weight="fill" />Wanted</a>
		<a href="/dashboard/orphans" class="{linkClass} {isActive('/dashboard/orphans') ? activeClass : inactiveClass}"><LinkBreak size={14} weight="fill" />Orphans</a>
		{#if permissions.canManageSettings || permissions.canManageUsers}
			<span class="border-l border-border-subtle mx-1"></span>
			{#if permissions.canManageSettings}
				<a href="/dashboard/settings" class="{linkClass} {isActive('/dashboard/settings') ? activeClass : inactiveClass}"><Wrench size={14} weight="fill" />Settings</a>
				<a href="/dashboard/export" class="{linkClass} {isActive('/dashboard/export') ? activeClass : inactiveClass}"><Export size={14} weight="fill" />Export</a>
			{/if}
			{#if permissions.canManageUsers}
				<a href="/dashboard/users" class="{linkClass} {isActive('/dashboard/users') ? activeClass : inactiveClass}"><Users size={14} weight="fill" />Users</a>
			{/if}
		{/if}
	</nav>

	{@render children()}
</div>
