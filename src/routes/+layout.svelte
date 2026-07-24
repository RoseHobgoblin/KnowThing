<script lang="ts">
	import '../app.css'
	import { Tooltip } from 'bits-ui'
	import { m } from '$lib/paraglide/messages.js'
	import { getLocale } from '$lib/paraglide/runtime.js'
	import { applyStoredLocale } from '$lib/i18n.svelte'
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte'
	import { page } from '$app/stores'
	import { normalizePermissions } from '$lib/permissions.js'
	import SearchBar from '$lib/components/SearchBar.svelte'
	import { Toaster } from 'svelte-sonner'
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'
	import { browser } from '$app/environment'
	import MediaLightbox from '$lib/components/MediaLightbox.svelte'
	import CommandPalette, { type PaletteAction } from '$lib/components/CommandPalette.svelte'
	import { commandPalette } from '$lib/components/command-palette.svelte'
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
	import type { LayoutData } from './$types.js'
	import House from 'phosphor-svelte/lib/House'
	import PlusCircle from 'phosphor-svelte/lib/PlusCircle'
	import Shuffle from 'phosphor-svelte/lib/Shuffle'
	import BookOpen from 'phosphor-svelte/lib/BookOpen'
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
	import MapTrifold from 'phosphor-svelte/lib/MapTrifold'
	import Planet from 'phosphor-svelte/lib/Planet'
	import Tag from 'phosphor-svelte/lib/Tag'
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
	import GearSix from 'phosphor-svelte/lib/GearSix'
	import SignOut from 'phosphor-svelte/lib/SignOut'
	import SignIn from 'phosphor-svelte/lib/SignIn'

	let { children, data }: { children: any, data: LayoutData } = $props()

	const queryClient = new QueryClient({
		defaultOptions: { queries: { enabled: browser, staleTime: 30_000 } },
	})
	let sidebarOpen = $state(false)
	let stablePermissions = $state(normalizePermissions($page.data.permissions))

	const sc = $derived(data.siteConfig)
	const permissions = $derived(stablePermissions)
	const siteNameParts = $derived((sc?.siteName ?? 'KnowThing').split(/(?=[A-Z])/))
	const currentPath = $derived($page.url.pathname)

	$effect(() => {
		if (data.permissions !== undefined) {
			stablePermissions = normalizePermissions(data.permissions)
		}
	})

	// Locale is client-only (localStorage). Applying it after mount keeps the
	// first client render matching the server (both baseLocale), then flips the
	// whole tree to the stored language reactively.
	$effect(() => {
		applyStoredLocale()
	})

	// Keep <html lang> in sync with the active locale (reactive via getLocale).
	$effect(() => {
		document.documentElement.lang = getLocale()
	})

	function isActive(href: string): boolean {
		if (href === '/') return currentPath === '/'
		return currentPath.startsWith(href)
	}

	// Command-palette destinations, mirroring the sidebar nav under the same
	// siteConfig/permission gating.
	const paletteActions = $derived.by<PaletteAction[]>(() => {
		const list: PaletteAction[] = [
			{ label: sc?.navWikiLabel ?? m.nav_main_page(), href: '/', icon: House, keywords: 'home wiki' },
		]
		if (sc?.wordbookEnabled !== false) list.push({ label: sc?.navWordbookLabel ?? m.nav_wordbook(), href: '/Wordbook', icon: BookOpen, keywords: 'dictionary lexicon language' })
		if (sc?.calendarEnabled !== false) list.push({ label: sc?.navCalendarLabel ?? m.nav_calendar(), href: '/calendar', icon: CalendarBlank, keywords: 'date' })
		list.push(
			{ label: m.nav_world_maps(), href: '/worldmap', icon: MapTrifold, keywords: 'map region country' },
			{ label: m.nav_celestial(), href: '/celestial', icon: Planet, keywords: 'star system planet space' },
			{ label: m.nav_categories(), href: '/special/categories', icon: Tag, keywords: 'tags' },
			{ label: m.header_random_page(), href: '/special/random', icon: Shuffle, keywords: 'surprise' },
		)
		if (permissions.isAuthenticated) {
			if (permissions.canCreatePages) list.push({ label: sc?.navCreateLabel ?? m.nav_new_page(), href: '/know/create', icon: PlusCircle, keywords: 'create write add article' })
			list.push({ label: m.nav_recent_changes(), href: '/dashboard/recent', icon: ClockCounterClockwise, keywords: 'history activity' })
			if (permissions.canManageSettings) list.push({ label: m.nav_settings(), href: '/dashboard/settings', icon: GearSix, keywords: 'admin configure preferences' })
			list.push({ label: m.auth_account(), href: '/auth/account', icon: SignOut, keywords: 'profile logout' })
		} else {
			list.push({ label: m.auth_log_in(), href: '/auth/login', icon: SignIn, keywords: 'sign in' })
		}
		return list
	})

	// Active state is carried by a left accent bar; the transparent border on the
	// inactive state keeps the label from shifting when it becomes active.
	const linkClass = 'flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors'
	const activeClass = 'border-accent bg-raised text-accent font-medium'
	const inactiveClass = 'border-transparent text-secondary hover:bg-raised hover:text-heading'
	const sectionClass = 'select-none px-3 pt-4 pb-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-dim'

	function navClick() {
		sidebarOpen = false
	}
</script>

{#snippet siteName(onNav?: () => void)}
	<a href="/" onclick={onNav} class="text-lg font-bold tracking-tight text-heading transition-colors hover:text-link">
		{#if sc?.logoUrl}
			<img src={sc.logoUrl} alt={sc?.siteName} class="h-7" />
		{:else if siteNameParts.length >= 2}
			{siteNameParts[0]}<span class="text-accent">{siteNameParts.slice(1).join('')}</span>
		{:else}
			{sc?.siteName ?? 'KnowThing'}
		{/if}
	</a>
{/snippet}

{#snippet navLinks(onNav?: () => void)}
	<p class={sectionClass}>{m.section_browse()}</p>
	<a href="/" onclick={onNav} class="{linkClass} {isActive('/') && currentPath === '/' ? activeClass : inactiveClass}"><House size={16} weight="fill" />{sc?.navWikiLabel ?? m.nav_main_page()}</a>
	{#if sc?.wordbookEnabled !== false}
		<a href="/Wordbook" onclick={onNav} class="{linkClass} {isActive('/Wordbook') ? activeClass : inactiveClass}"><BookOpen size={16} weight="fill" />{sc?.navWordbookLabel ?? m.nav_wordbook()}</a>
	{/if}
	{#if sc?.calendarEnabled !== false}
		<a href="/calendar" onclick={onNav} class="{linkClass} {isActive('/calendar') ? activeClass : inactiveClass}"><CalendarBlank size={16} weight="fill" />{sc?.navCalendarLabel ?? m.nav_calendar()}</a>
	{/if}
	<a href="/worldmap" onclick={onNav} class="{linkClass} {isActive('/worldmap') ? activeClass : inactiveClass}"><MapTrifold size={16} weight="fill" />{m.nav_world_maps()}</a>
	<a href="/celestial" onclick={onNav} class="{linkClass} {isActive('/celestial') ? activeClass : inactiveClass}"><Planet size={16} weight="fill" />{m.nav_celestial()}</a>

	<p class={sectionClass}>{m.section_discover()}</p>
	<a href="/special/categories" onclick={onNav} class="{linkClass} {isActive('/special/categories') ? activeClass : inactiveClass}"><Tag size={16} weight="fill" />{m.nav_categories()}</a>
	<a href="/special/random" onclick={onNav} class="{linkClass} {inactiveClass}"><Shuffle size={16} weight="fill" />{m.nav_random()}</a>

	{#if permissions.isAuthenticated}
		<p class={sectionClass}>{m.section_contribute()}</p>
		{#if permissions.canCreatePages}
			<a href="/know/create" onclick={onNav} class="{linkClass} {isActive('/know/create') ? activeClass : inactiveClass}"><PlusCircle size={16} weight="fill" />{sc?.navCreateLabel ?? m.nav_new_page()}</a>
		{/if}
		<a href="/dashboard/recent" onclick={onNav} class="{linkClass} {isActive('/dashboard/recent') ? activeClass : inactiveClass}"><ClockCounterClockwise size={16} weight="fill" />{m.nav_recent_changes()}</a>
		{#if permissions.canManageSettings}
			<p class={sectionClass}>{m.section_manage()}</p>
			<a href="/dashboard/settings" onclick={onNav} class="{linkClass} {isActive('/dashboard') ? activeClass : inactiveClass}"><GearSix size={16} weight="fill" />{m.nav_settings()}</a>
		{/if}
	{/if}
{/snippet}

{#snippet userFooter(onNav?: () => void)}
	<div class="border-t border-border-subtle p-3 text-xs">
		{#if data.user}
			<div class="flex items-center justify-between">
				<a href="/auth/account" onclick={onNav} class="truncate text-dim transition-colors hover:text-link">{data.user.username}</a>
				<form method="POST" action="/auth/logout">
					<button type="submit" onclick={onNav} class="flex items-center gap-1.5 text-secondary transition-colors hover:text-link"><SignOut size={14} weight="fill" />{m.auth_log_out()}</button>
				</form>
			</div>
		{:else}
			<div class="flex items-center gap-3">
				<a href="/auth/login" onclick={onNav} class="flex items-center gap-1.5 text-link transition-colors hover:text-link-hover"><SignIn size={14} weight="fill" />{m.auth_log_in()}</a>
				<a href="/auth/register" onclick={onNav} class="text-link transition-colors hover:text-link-hover">{m.auth_register()}</a>
			</div>
		{/if}
	</div>
{/snippet}

<QueryClientProvider client={queryClient}>
<Tooltip.Provider>
<div class="h-screen flex bg-page overflow-hidden" dir={sc?.textDirection ?? 'ltr'}>

	<!-- Sidebar (desktop) -->
	<aside class="hidden w-56 shrink-0 flex-col h-screen border-r border-border bg-surface md:flex">
		<!-- Logo -->
		<div class="flex h-12 items-center border-b border-border-subtle px-4">
			{@render siteName()}
		</div>

		<!-- Nav links -->
		<nav class="flex-1 overflow-y-auto px-2 pb-3">
			{@render navLinks()}
		</nav>

		<!-- User footer -->
		{@render userFooter()}
	</aside>

	<!-- Main area -->
	<div class="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
		<!-- Top bar -->
		<header class="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 md:px-4">
			<button
				onclick={() => sidebarOpen = !sidebarOpen}
				class="p-1 text-secondary hover:text-link md:hidden"
				aria-label={m.header_toggle_menu()}
			>
				<svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if sidebarOpen}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>
			<div class="md:hidden">
				{@render siteName()}
			</div>
			<div class="flex-1 max-w-xl">
				<SearchBar />
			</div>

			<!-- Language switcher (all breakpoints) -->
			<div class="shrink-0">
				<LanguageSwitcher />
			</div>

			<!-- Quick actions (desktop) -->
			<div class="hidden items-center gap-1 shrink-0 md:flex">
				<button
					type="button"
					onclick={() => commandPalette.show()}
					title={m.header_command_palette()}
					aria-label={m.header_open_command_palette()}
					class="flex items-center gap-1.5 p-2 text-secondary transition-colors hover:bg-raised hover:text-heading"
				>
					<MagnifyingGlass size={18} weight="bold" />
					<kbd class="hidden rounded-sm border border-border-subtle px-1.5 py-0.5 text-[0.65rem] text-dim lg:inline">⌘K</kbd>
				</button>
				<a
					href="/special/random"
					title={m.header_random_page()}
					aria-label={m.header_random_page()}
					class="flex items-center justify-center p-2 text-secondary transition-colors hover:bg-raised hover:text-heading"
				>
					<Shuffle size={18} weight="fill" />
				</a>

				{#if permissions.canCreatePages}
					<a
						href="/know/create"
						class="ml-1 flex items-center gap-1.5 bg-accent px-3 py-1.5 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
					>
						<PlusCircle size={16} weight="fill" />{sc?.navCreateLabel ?? m.nav_new_page()}
					</a>
				{:else if !permissions.isAuthenticated}
					<a
						href="/auth/login"
						class="ml-1 flex items-center gap-1.5 px-3 py-1.5 text-sm text-link transition-colors hover:text-link-hover"
					>
						<SignIn size={16} weight="fill" />{m.auth_log_in()}
					</a>
				{/if}
			</div>
			</header>

		<!-- Mobile sidebar overlay -->
		{#if sidebarOpen}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div class="fixed inset-0 z-40 bg-black/40 md:hidden" onclick={() => sidebarOpen = false}></div>
			<aside class="fixed left-0 top-0 z-50 flex w-64 h-full flex-col border-r border-border bg-surface md:hidden">
				<div class="flex h-12 shrink-0 items-center border-b border-border-subtle px-4">
					{@render siteName(navClick)}
				</div>
				<nav class="flex-1 overflow-y-auto px-2 pb-3">
					{@render navLinks(navClick)}
				</nav>
				{@render userFooter(navClick)}
			</aside>
		{/if}

		<!-- Scrollable content -->
		<main class="flex-1 overflow-y-auto flex flex-col">
			<div class="flex-1 {currentPath.includes('/edit') || currentPath === '/know/create' ? 'w-full px-6 py-4' : 'max-w-6xl mx-auto w-full px-4 py-6 md:px-6 md:py-8'}">
				{#key currentPath}
					{@render children()}
				{/key}
			</div>
			<footer class="bg-surface p-4 shrink-0 mt-auto">
				<div class="max-w-6xl mx-auto text-xs text-secondary text-center">
					{#if sc?.footerText}
						{sc.footerText}
					{:else}
						{sc?.siteName ?? 'KnowThing'} — {sc?.siteTagline ?? m.footer_tagline()}
					{/if}
				</div>
			</footer>
		</main>
	</div>
</div>

<!-- Inside the provider: the palette uses TanStack Query for its search. -->
<CommandPalette actions={paletteActions} />
</Tooltip.Provider>
</QueryClientProvider>

<Toaster
	position="bottom-center"
	style="--normal-bg: var(--color-surface); --normal-text: var(--color-body); --normal-border: var(--color-accent-border); --border-radius: 0;"
	toastOptions={{ class: 'shadow-lg' }}
/>
<MediaLightbox />
