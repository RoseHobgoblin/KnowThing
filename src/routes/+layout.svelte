<script lang="ts">
	import '../app.css'
	import { Tooltip } from 'bits-ui'
	import { page } from '$app/stores'
	import SearchBar from '$lib/components/SearchBar.svelte'
	import Notifications from '$lib/components/ui/Notifications.svelte'
	import type { LayoutData } from './$types.js'
	import House from 'phosphor-svelte/lib/House'
	import PlusCircle from 'phosphor-svelte/lib/PlusCircle'
	import Shuffle from 'phosphor-svelte/lib/Shuffle'
	import BookOpen from 'phosphor-svelte/lib/BookOpen'
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Tag from 'phosphor-svelte/lib/Tag'
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import SignOut from 'phosphor-svelte/lib/SignOut'
	import SignIn from 'phosphor-svelte/lib/SignIn'

	let { children, data }: { children: any, data: LayoutData } = $props()
	let sidebarOpen = $state(false)

	const sc = $derived(data.siteConfig)
	const permissions = $derived(data.permissions)
	const siteNameParts = $derived((sc?.siteName ?? 'KnowThing').split(/(?=[A-Z])/))
	const currentPath = $derived($page.url.pathname)

	function isActive(href: string): boolean {
		if (href === '/') return currentPath === '/'
		return currentPath.startsWith(href)
	}

	const linkClass = 'flex items-center gap-3 px-3 py-2 text-sm transition-colors'
	const activeClass = 'bg-raised text-accent font-medium'
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
			<a href="/" class="{linkClass} {isActive('/') && currentPath === '/' ? activeClass : inactiveClass}"><House size={16} weight="fill" />{sc?.navWikiLabel ?? 'Main Page'}</a>
			{#if sc?.wordbookEnabled !== false}
				<a href="/wordbook" class="{linkClass} {isActive('/wordbook') ? activeClass : inactiveClass}"><BookOpen size={16} weight="fill" />{sc?.navWordbookLabel ?? 'Wordbook'}</a>
			{/if}
			{#if sc?.calendarEnabled !== false}
				<a href="/calendar" class="{linkClass} {isActive('/calendar') ? activeClass : inactiveClass}"><CalendarBlank size={16} weight="fill" />{sc?.navCalendarLabel ?? 'Calendar'}</a>
			{/if}
			<a href="/celestial" class="{linkClass} {isActive('/celestial') ? activeClass : inactiveClass}"><Planet size={16} weight="fill" />Celestial</a>

			<div class="my-2 border-t border-border-subtle"></div>

			<a href="/special/categories" class="{linkClass} {isActive('/special/categories') ? activeClass : inactiveClass}"><Tag size={16} weight="fill" />Categories</a>
			<a href="/special/random" class="{linkClass} {inactiveClass}"><Shuffle size={16} weight="fill" />Random</a>

			{#if data.user}
				<div class="my-2 border-t border-border-subtle"></div>
				{#if permissions.canCreatePages}
					<a href="/know/create" class="{linkClass} {isActive('/know/create') ? activeClass : inactiveClass}"><PlusCircle size={16} weight="fill" />{sc?.navCreateLabel ?? 'New Page'}</a>
				{/if}
				<a href="/dashboard/recent" class="{linkClass} {isActive('/dashboard/recent') ? activeClass : inactiveClass}"><ClockCounterClockwise size={16} weight="fill" />Recent Changes</a>
				{#if permissions.canManageSettings}
					<div class="my-2 border-t border-border-subtle"></div>
					<a href="/dashboard/settings" class="{linkClass} {isActive('/dashboard') ? activeClass : inactiveClass}"><GearSix size={16} weight="fill" />Settings</a>
				{/if}
			{/if}
		</nav>

		<!-- User footer -->
		<div class="px-3 py-3 border-t border-border-subtle text-xs">
			{#if data.user}
				<div class="flex items-center justify-between">
					<a href="/auth/account" class="text-dim truncate transition-colors hover:text-link">{data.user.username}</a>
					<form method="POST" action="/auth/logout">
						<button type="submit" class="text-secondary transition-colors hover:text-link flex items-center gap-1.5"><SignOut size={14} weight="fill" />Log out</button>
					</form>
				</div>
			{:else}
				<div class="flex items-center gap-3">
					<a href="/auth/login" class="text-link flex items-center gap-1.5 transition-colors hover:text-link-hover"><SignIn size={14} weight="fill" />Log in</a>
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
					<a href="/" onclick={navClick} class="{linkClass} {isActive('/') && currentPath === '/' ? activeClass : inactiveClass}"><House size={16} weight="fill" />{sc?.navWikiLabel ?? 'Main Page'}</a>
					{#if sc?.wordbookEnabled !== false}
						<a href="/wordbook" onclick={navClick} class="{linkClass} {isActive('/wordbook') ? activeClass : inactiveClass}"><BookOpen size={16} weight="fill" />{sc?.navWordbookLabel ?? 'Wordbook'}</a>
					{/if}
					{#if sc?.calendarEnabled !== false}
						<a href="/calendar" onclick={navClick} class="{linkClass} {isActive('/calendar') ? activeClass : inactiveClass}"><CalendarBlank size={16} weight="fill" />{sc?.navCalendarLabel ?? 'Calendar'}</a>
					{/if}
					<a href="/celestial" onclick={navClick} class="{linkClass} {isActive('/celestial') ? activeClass : inactiveClass}"><Planet size={16} weight="fill" />Celestial</a>

					<div class="my-2 border-t border-border-subtle"></div>

					<a href="/special/categories" onclick={navClick} class="{linkClass} {isActive('/special/categories') ? activeClass : inactiveClass}"><Tag size={16} weight="fill" />Categories</a>
					<a href="/special/random" onclick={navClick} class="{linkClass} {inactiveClass}"><Shuffle size={16} weight="fill" />Random</a>

					{#if data.user}
						<div class="my-2 border-t border-border-subtle"></div>
						{#if permissions.canCreatePages}
							<a href="/know/create" onclick={navClick} class="{linkClass} {isActive('/know/create') ? activeClass : inactiveClass}"><PlusCircle size={16} weight="fill" />{sc?.navCreateLabel ?? 'New Page'}</a>
						{/if}
						<a href="/dashboard/recent" onclick={navClick} class="{linkClass} {isActive('/dashboard/recent') ? activeClass : inactiveClass}"><ClockCounterClockwise size={16} weight="fill" />Recent Changes</a>
						{#if permissions.canManageSettings}
							<div class="my-2 border-t border-border-subtle"></div>
							<a href="/dashboard/settings" onclick={navClick} class="{linkClass} {isActive('/dashboard') ? activeClass : inactiveClass}"><GearSix size={16} weight="fill" />Settings</a>
						{/if}
					{/if}
				</nav>
				<div class="px-3 py-3 border-t border-border-subtle text-xs">
					{#if data.user}
						<div class="flex items-center justify-between">
							<a href="/auth/account" onclick={navClick} class="text-dim truncate transition-colors hover:text-link">{data.user.username}</a>
							<form method="POST" action="/auth/logout">
								<button type="submit" class="text-secondary transition-colors hover:text-link flex items-center gap-1.5" onclick={navClick}><SignOut size={14} weight="fill" />Log out</button>
							</form>
						</div>
					{:else}
						<div class="flex items-center gap-3">
							<a href="/auth/login" onclick={navClick} class="text-link flex items-center gap-1.5 transition-colors hover:text-link-hover"><SignIn size={14} weight="fill" />Log in</a>
							<a href="/auth/register" onclick={navClick} class="text-link transition-colors hover:text-link-hover">Register</a>
						</div>
					{/if}
				</div>
			</aside>
		{/if}

		<!-- Scrollable content -->
		<main class="flex-1 overflow-y-auto flex flex-col">
			<div class="flex-1 {currentPath.includes('/edit') || currentPath === '/know/create' ? 'w-full px-6 py-4' : 'max-w-6xl mx-auto w-full px-4 py-6 md:px-6 md:py-8'}">
				{#key currentPath}
					{@render children()}
				{/key}
			</div>
			<footer class="border-t border-border bg-surface p-4 shrink-0 mt-auto">
				<div class="max-w-6xl mx-auto text-xs text-faint text-center">
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
