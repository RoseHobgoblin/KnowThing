<script lang="ts">
	import '../app.css'
	import { Tooltip } from 'bits-ui'
	import { page } from '$app/stores'
	import SearchBar from '$lib/components/SearchBar.svelte'
	import Notifications from '$lib/components/ui/Notifications.svelte'
	import type { LayoutData } from './$types.js'

	let { children, data }: { children: any, data: LayoutData } = $props()
	let sidebarOpen = $state(false)

	const sc = $derived(data.siteConfig)
	const siteNameParts = $derived((sc?.siteName ?? 'KnowThing').split(/(?=[A-Z])/))
	const currentPath = $derived($page.url.pathname)

	function isActive(href: string): boolean {
		if (href === '/') return currentPath === '/'
		return currentPath.startsWith(href)
	}

	const linkClass = 'flex items-center gap-3 px-3 py-2 text-sm transition-colors'
	const activeClass = 'bg-accent-subtle text-link font-medium'
	const inactiveClass = 'text-secondary hover:bg-raised hover:text-heading'

	function navClick() {
		sidebarOpen = false
	}
</script>

<Tooltip.Provider>
<div class="h-screen flex bg-page overflow-hidden" dir={sc?.textDirection ?? 'ltr'}>

	<!-- Sidebar (desktop) -->
	<aside class="hidden w-56 shrink-0 bg-surface border-r border-border flex-col h-screen md:flex">
		<!-- Logo -->
		<div class="px-4 py-4 border-b border-border-subtle">
			<a href="/" class="text-lg font-bold text-heading tracking-tight transition-colors hover:text-link">
				{#if sc?.logoUrl}
					<img src={sc.logoUrl} alt={sc?.siteName} class="h-7" />
				{:else if siteNameParts.length >= 2}
					{siteNameParts[0]}<span class="text-accent">{siteNameParts.slice(1).join('')}</span>
				{:else}
					{sc?.siteName ?? 'KnowThing'}
				{/if}
			</a>
		</div>

		<!-- Nav links -->
		<nav class="flex-1 overflow-y-auto px-2 py-3 space-y-1">
			<span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">Browse</span>
			<a href="/" class="{linkClass} {isActive('/') && currentPath === '/' ? activeClass : inactiveClass}">{sc?.navWikiLabel ?? 'Main Page'}</a>
			<a href="/know/create" class="{linkClass} {isActive('/know/create') ? activeClass : inactiveClass}">{sc?.navCreateLabel ?? 'Create'}</a>
			<a href="/search" class="{linkClass} {isActive('/search') ? activeClass : inactiveClass}">{sc?.navSearchLabel ?? 'Search'}</a>
			<a href="/special/random" class="{linkClass} {inactiveClass}">Random</a>

			{#if sc?.wordbookEnabled !== false}
				<div class="pt-3"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">{sc?.wordbookName ?? 'Wordbook'}</span></div>
				<a href="/wordbook" class="{linkClass} {isActive('/wordbook') ? activeClass : inactiveClass}">{sc?.navWordbookLabel ?? 'Wordbook'}</a>
			{/if}

			{#if sc?.calendarEnabled !== false}
				<div class="pt-3"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">{sc?.navCalendarLabel ?? 'Calendar'}</span></div>
				<a href="/calendar" class="{linkClass} {isActive('/calendar') ? activeClass : inactiveClass}">{sc?.navCalendarLabel ?? 'Calendar'}</a>
			{/if}

			<div class="pt-3"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">Discover</span></div>
			<a href="/special/categories" class="{linkClass} {isActive('/special/categories') ? activeClass : inactiveClass}">Categories</a>
			<a href="/special/stats" class="{linkClass} {isActive('/special/stats') ? activeClass : inactiveClass}">Statistics</a>

			{#if data.user}
				<div class="pt-3"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">Contribute</span></div>
				<a href="/dashboard" class="{linkClass} {isActive('/dashboard') && currentPath === '/dashboard' ? activeClass : inactiveClass}">Dashboard</a>
				<a href="/dashboard/recent" class="{linkClass} {isActive('/dashboard/recent') ? activeClass : inactiveClass}">Recent Changes</a>
				<a href="/dashboard/media" class="{linkClass} {isActive('/dashboard/media') ? activeClass : inactiveClass}">Media Library</a>

				{#if data.user.role === 'admin'}
					<div class="pt-3"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">Admin</span></div>
					<a href="/dashboard/calendar" class="{linkClass} {isActive('/dashboard/calendar') ? activeClass : inactiveClass}">Calendars</a>
					<a href="/dashboard/users" class="{linkClass} {isActive('/dashboard/users') ? activeClass : inactiveClass}">Users</a>
					<a href="/dashboard/settings" class="{linkClass} {isActive('/dashboard/settings') ? activeClass : inactiveClass}">Site Settings</a>
					<a href="/dashboard/export" class="{linkClass} {isActive('/dashboard/export') ? activeClass : inactiveClass}">Export</a>
				{/if}
			{/if}
		</nav>

		<!-- User footer -->
		<div class="px-3 py-3 border-t border-border-subtle text-xs">
			{#if data.user}
				<div class="flex items-center justify-between">
					<span class="text-dim truncate">{data.user.username}</span>
					<form method="POST" action="/auth/logout">
						<button type="submit" class="text-link transition-colors hover:text-link-hover">Log out</button>
					</form>
				</div>
			{:else}
				<div class="flex items-center gap-2">
					<a href="/auth/login" class="text-link transition-colors hover:text-link-hover">Log in</a>
					<a href="/auth/register" class="text-link transition-colors hover:text-link-hover">Register</a>
				</div>
			{/if}
		</div>
	</aside>

	<!-- Main area -->
	<div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
		<!-- Top bar -->
		<header class="bg-surface border-b border-border px-4 py-2.5 flex items-center gap-4 shrink-0">
			<button
				onclick={() => sidebarOpen = !sidebarOpen}
				class="text-secondary p-1 md:hidden hover:text-link"
				aria-label="Toggle menu"
			>
				<svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if sidebarOpen}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>
			<a href="/" class="text-lg font-bold text-heading md:hidden">
				{#if siteNameParts.length >= 2}
					{siteNameParts[0]}<span class="text-accent">{siteNameParts.slice(1).join('')}</span>
				{:else}
					{sc?.siteName ?? 'KnowThing'}
				{/if}
			</a>
			<div class="flex-1 max-w-xl">
				<SearchBar />
			</div>
			</header>

		<!-- Mobile sidebar overlay -->
		{#if sidebarOpen}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="fixed inset-0 z-40 bg-black/40 md:hidden" onclick={() => sidebarOpen = false}></div>
			<aside class="fixed left-0 top-0 z-50 w-64 h-full bg-surface border-r border-border overflow-y-auto md:hidden">
				<div class="px-4 py-4 border-b border-border-subtle">
					<a href="/" class="text-lg font-bold text-heading" onclick={navClick}>
						{#if siteNameParts.length >= 2}
							{siteNameParts[0]}<span class="text-accent">{siteNameParts.slice(1).join('')}</span>
						{:else}
							{sc?.siteName ?? 'KnowThing'}
						{/if}
					</a>
				</div>
				<nav class="px-2 py-3 space-y-1">
					<span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">Browse</span>
					<a href="/" onclick={navClick} class="{linkClass} {isActive('/') && currentPath === '/' ? activeClass : inactiveClass}">{sc?.navWikiLabel ?? 'Main Page'}</a>
					<a href="/know/create" onclick={navClick} class="{linkClass} {isActive('/know/create') ? activeClass : inactiveClass}">{sc?.navCreateLabel ?? 'Create'}</a>
					<a href="/search" onclick={navClick} class="{linkClass} {isActive('/search') ? activeClass : inactiveClass}">{sc?.navSearchLabel ?? 'Search'}</a>
					<a href="/special/random" onclick={navClick} class="{linkClass} {inactiveClass}">Random</a>
					{#if sc?.wordbookEnabled !== false}
						<div class="pt-2"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">{sc?.wordbookName ?? 'Wordbook'}</span></div>
						<a href="/wordbook" onclick={navClick} class="{linkClass} {isActive('/wordbook') ? activeClass : inactiveClass}">{sc?.navWordbookLabel ?? 'Wordbook'}</a>
					{/if}
					{#if sc?.calendarEnabled !== false}
						<div class="pt-2"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">{sc?.navCalendarLabel ?? 'Calendar'}</span></div>
						<a href="/calendar" onclick={navClick} class="{linkClass} {isActive('/calendar') ? activeClass : inactiveClass}">{sc?.navCalendarLabel ?? 'Calendar'}</a>
					{/if}
					<div class="pt-2"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">Discover</span></div>
					<a href="/special/categories" onclick={navClick} class="{linkClass} {isActive('/special/categories') ? activeClass : inactiveClass}">Categories</a>
					<a href="/special/stats" onclick={navClick} class="{linkClass} {isActive('/special/stats') ? activeClass : inactiveClass}">Statistics</a>
					{#if data.user}
						<div class="pt-2"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">Contribute</span></div>
						<a href="/dashboard" onclick={navClick} class="{linkClass} {isActive('/dashboard') ? activeClass : inactiveClass}">Dashboard</a>
						<a href="/dashboard/recent" onclick={navClick} class="{linkClass} {isActive('/dashboard/recent') ? activeClass : inactiveClass}">Recent Changes</a>
						<a href="/dashboard/media" onclick={navClick} class="{linkClass} {isActive('/dashboard/media') ? activeClass : inactiveClass}">Media Library</a>
						{#if data.user.role === 'admin'}
							<div class="pt-2"><span class="px-3 text-[10px] font-semibold text-faint uppercase tracking-wider">Admin</span></div>
							<a href="/dashboard/calendar" onclick={navClick} class="{linkClass} {isActive('/dashboard/calendar') ? activeClass : inactiveClass}">Calendars</a>
							<a href="/dashboard/users" onclick={navClick} class="{linkClass} {isActive('/dashboard/users') ? activeClass : inactiveClass}">Users</a>
							<a href="/dashboard/settings" onclick={navClick} class="{linkClass} {isActive('/dashboard/settings') ? activeClass : inactiveClass}">Settings</a>
							<a href="/dashboard/export" onclick={navClick} class="{linkClass} {isActive('/dashboard/export') ? activeClass : inactiveClass}">Export</a>
						{/if}
					{/if}
				</nav>
				{#if data.user}
					<div class="px-4 py-3 border-t border-border-subtle text-xs flex items-center justify-between">
						<span class="text-dim">{data.user.username}</span>
						<form method="POST" action="/auth/logout">
							<button type="submit" class="text-link" onclick={navClick}>Log out</button>
						</form>
					</div>
				{:else}
					<div class="px-4 py-3 border-t border-border-subtle text-xs flex gap-3">
						<a href="/auth/login" onclick={navClick} class="text-link">Log in</a>
						<a href="/auth/register" onclick={navClick} class="text-link">Register</a>
					</div>
				{/if}
			</aside>
		{/if}

		<!-- Scrollable content -->
		<main class="flex-1 overflow-y-auto">
			<div class="max-w-4xl mx-auto w-full px-4 py-6 md:px-6 md:py-8">
				{@render children()}
			</div>
			<footer class="border-t border-border bg-surface p-4">
				<div class="max-w-4xl mx-auto text-xs text-faint text-center">
					{#if sc?.footerText}
						{sc.footerText}
					{:else}
						{sc?.siteName ?? 'KnowThing'} — {sc?.siteTagline ?? 'A collaborative encyclopedia'}
					{/if}
				</div>
			</footer>
		</main>
	</div>
</div>
</Tooltip.Provider>

<Notifications />
