<script lang="ts">
	import '../app.css'
	import SearchBar from '$lib/components/SearchBar.svelte'
	import type { LayoutData } from './$types.js'

	let { children, data }: { children: any, data: LayoutData } = $props()
	let mobileMenuOpen = $state(false)
</script>

<div class="h-screen flex flex-col bg-page overflow-hidden">
	<!-- Amber accent strip -->
	<div class="h-1 bg-accent-subtle0 shrink-0"></div>

	<!-- Header -->
	<header class="
		bg-surface border-b border-border px-4 py-3 flex items-center justify-between shrink-0
		md:px-6
	">
		<div class="flex items-center gap-3">
			<!-- Mobile hamburger -->
			<button
				onclick={() => mobileMenuOpen = !mobileMenuOpen}
				class="text-secondary p-1 md:hidden hover:text-link"
				aria-label="Toggle menu"
			>
				<svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if mobileMenuOpen}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>

			<a href="/" class="text-xl font-bold text-heading tracking-tight transition-colors hover:text-link">
				Know<span class="text-accent">Thing</span>
			</a>
		</div>

		<!-- Search — hidden on mobile, shown in mobile menu instead -->
		<div class="hidden flex-1 max-w-md mx-8 md:block">
			<SearchBar />
		</div>

		<nav class="flex items-center gap-3 text-sm md:gap-4">
			{#if data.user}
				<span class="text-dim hidden sm:inline">{data.user.username}</span>
				<form method="POST" action="/auth/logout">
					<button type="submit" class="text-link transition-colors hover:text-link-hover hover:underline">Log out</button>
				</form>
			{:else}
				<a href="/auth/login" class="text-link transition-colors hover:text-link-hover hover:underline">Log in</a>
				<a href="/auth/register" class="
					px-3 py-1.5 bg-accent text-surface rounded-md text-xs font-medium transition-colors hidden
					hover:bg-accent-hover
					sm:inline-block
				">Register</a>
			{/if}
		</nav>
	</header>

	<!-- Desktop horizontal navigation -->
	<nav class="hidden bg-surface border-b border-border px-6 shadow-sm shrink-0 md:block">
		<div class="max-w-4xl mx-auto flex items-center gap-1 text-sm">
			<a href="/" class="
				px-3 py-2.5 text-secondary rounded-t-md transition-colors font-medium
				hover:text-link hover:bg-accent-subtle
			">
				Main Page
			</a>
			<a href="/know/create" class="
				px-3 py-2.5 text-secondary rounded-t-md transition-colors font-medium
				hover:text-link hover:bg-accent-subtle
			">
				Create
			</a>
			<a href="/calendar" class="
				px-3 py-2.5 text-secondary rounded-t-md transition-colors font-medium
				hover:text-link hover:bg-accent-subtle
			">
				Calendar
			</a>
			<a href="/wordbook" class="
				px-3 py-2.5 text-secondary rounded-t-md transition-colors font-medium
				hover:text-link hover:bg-accent-subtle
			">
				Wordbook
			</a>
			<a href="/search" class="
				px-3 py-2.5 text-secondary rounded-t-md transition-colors font-medium
				hover:text-link hover:bg-accent-subtle
			">
				Search
			</a>

			<div class="h-4 w-px bg-border mx-1"></div>

			<a href="/special/random" class="
				px-3 py-2.5 text-dim rounded-t-md transition-colors text-xs
				hover:text-link hover:bg-accent-subtle
			">
				Random
			</a>
			<a href="/special/categories" class="
				px-3 py-2.5 text-dim rounded-t-md transition-colors text-xs
				hover:text-link hover:bg-accent-subtle
			">
				Categories
			</a>
			<a href="/special/stats" class="
				px-3 py-2.5 text-dim rounded-t-md transition-colors text-xs
				hover:text-link hover:bg-accent-subtle
			">
				Stats
			</a>

			{#if data.user}
				<div class="h-4 w-px bg-border mx-1"></div>
				<a href="/dashboard" class="
					px-3 py-2.5 text-link rounded-t-md transition-colors text-xs font-medium
					hover:text-link-hover hover:bg-accent-subtle
				">
					Dashboard
				</a>
			{/if}
		</div>
	</nav>

	<!-- Mobile menu dropdown -->
	{#if mobileMenuOpen}
		<div class="bg-surface border-b border-border shadow-sm shrink-0 md:hidden">
			<div class="px-4 py-3">
				<SearchBar />
			</div>
			<nav class="px-2 pb-3 space-y-0.5">
				<a href="/" onclick={() => mobileMenuOpen = false} class="
					block px-3 py-2 text-secondary rounded-md text-sm font-medium
					hover:bg-accent-subtle hover:text-link
				">Main Page</a>
				<a href="/know/create" onclick={() => mobileMenuOpen = false} class="
					block px-3 py-2 text-secondary rounded-md text-sm font-medium
					hover:bg-accent-subtle hover:text-link
				">Create</a>
				<a href="/calendar" onclick={() => mobileMenuOpen = false} class="
					block px-3 py-2 text-secondary rounded-md text-sm font-medium
					hover:bg-accent-subtle hover:text-link
				">Calendar</a>
				<a href="/wordbook" onclick={() => mobileMenuOpen = false} class="
					block px-3 py-2 text-secondary rounded-md text-sm font-medium
					hover:bg-accent-subtle hover:text-link
				">Wordbook</a>
				<a href="/search" onclick={() => mobileMenuOpen = false} class="
					block px-3 py-2 text-secondary rounded-md text-sm font-medium
					hover:bg-accent-subtle hover:text-link
				">Search</a>
				<div class="border-t border-border-subtle my-1"></div>
				<a href="/special/random" onclick={() => mobileMenuOpen = false} class="
					block px-3 py-2 text-dim rounded-md text-sm
					hover:bg-accent-subtle hover:text-link
				">Random</a>
				<a href="/special/categories" onclick={() => mobileMenuOpen = false} class="
					block px-3 py-2 text-dim rounded-md text-sm
					hover:bg-accent-subtle hover:text-link
				">Categories</a>
				<a href="/special/stats" onclick={() => mobileMenuOpen = false} class="
					block px-3 py-2 text-dim rounded-md text-sm
					hover:bg-accent-subtle hover:text-link
				">Stats</a>
				{#if data.user}
					<div class="border-t border-border-subtle my-1"></div>
					<a href="/dashboard" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-link rounded-md text-sm font-medium hover:bg-accent-subtle">Dashboard</a>
				{/if}
			</nav>
		</div>
	{/if}

	<!-- Scrollable content area -->
	<main class="flex-1 overflow-y-auto">
		<div class="max-w-4xl mx-auto w-full px-4 py-6 md:px-6 md:py-8">
			{@render children()}
		</div>

		<footer class="border-t border-border bg-surface p-4 md:px-6">
			<div class="max-w-4xl mx-auto text-xs text-faint text-center">
				KnowThing — A collaborative encyclopedia
			</div>
		</footer>
	</main>
</div>
