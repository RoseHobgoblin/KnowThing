<script lang="ts">
	import '../app.css';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: any; data: LayoutData } = $props();
	let mobileMenuOpen = $state(false);
</script>

<div class="h-screen flex flex-col bg-stone-50 overflow-hidden">
	<!-- Amber accent strip -->
	<div class="h-1 bg-amber-500 shrink-0"></div>

	<!-- Header -->
	<header class="bg-white border-b border-stone-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
		<div class="flex items-center gap-3">
			<!-- Mobile hamburger -->
			<button
				onclick={() => mobileMenuOpen = !mobileMenuOpen}
				class="md:hidden text-stone-600 hover:text-amber-700 p-1"
				aria-label="Toggle menu"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					{#if mobileMenuOpen}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>

			<a href="/" class="text-xl font-bold text-stone-900 tracking-tight hover:text-amber-700 transition-colors">
				Know<span class="text-amber-600">Thing</span>
			</a>
		</div>

		<!-- Search — hidden on mobile, shown in mobile menu instead -->
		<div class="hidden md:block flex-1 max-w-md mx-8">
			<SearchBar />
		</div>

		<nav class="flex items-center gap-3 md:gap-4 text-sm">
			{#if data.user}
				<span class="text-stone-500 hidden sm:inline">{data.user.username}</span>
				<form method="POST" action="/auth/logout">
					<button type="submit" class="text-amber-700 hover:text-amber-900 hover:underline transition-colors">Log out</button>
				</form>
			{:else}
				<a href="/auth/login" class="text-amber-700 hover:text-amber-900 hover:underline transition-colors">Log in</a>
				<a href="/auth/register" class="px-3 py-1.5 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors hidden sm:inline-block">Register</a>
			{/if}
		</nav>
	</header>

	<!-- Desktop horizontal navigation -->
	<nav class="hidden md:block bg-white border-b border-stone-200 px-6 shadow-sm shrink-0">
		<div class="max-w-4xl mx-auto flex items-center gap-1 text-sm">
			<a href="/" class="px-3 py-2.5 text-stone-600 hover:text-amber-700 hover:bg-amber-50 rounded-t-md transition-colors font-medium">
				Main Page
			</a>
			<a href="/know/create" class="px-3 py-2.5 text-stone-600 hover:text-amber-700 hover:bg-amber-50 rounded-t-md transition-colors font-medium">
				Create
			</a>
			<a href="/calendar" class="px-3 py-2.5 text-stone-600 hover:text-amber-700 hover:bg-amber-50 rounded-t-md transition-colors font-medium">
				Calendar
			</a>
			<a href="/search" class="px-3 py-2.5 text-stone-600 hover:text-amber-700 hover:bg-amber-50 rounded-t-md transition-colors font-medium">
				Search
			</a>

			<div class="h-4 w-px bg-stone-200 mx-1"></div>

			<a href="/special/random" class="px-3 py-2.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-t-md transition-colors text-xs">
				Random
			</a>
			<a href="/special/categories" class="px-3 py-2.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-t-md transition-colors text-xs">
				Categories
			</a>
			<a href="/special/stats" class="px-3 py-2.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-t-md transition-colors text-xs">
				Stats
			</a>

			{#if data.user}
				<div class="h-4 w-px bg-stone-200 mx-1"></div>
				<a href="/dashboard" class="px-3 py-2.5 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded-t-md transition-colors text-xs font-medium">
					Dashboard
				</a>
			{/if}
		</div>
	</nav>

	<!-- Mobile menu dropdown -->
	{#if mobileMenuOpen}
		<div class="md:hidden bg-white border-b border-stone-200 shadow-sm shrink-0">
			<div class="px-4 py-3">
				<SearchBar />
			</div>
			<nav class="px-2 pb-3 space-y-0.5">
				<a href="/" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-stone-700 hover:bg-amber-50 hover:text-amber-700 rounded-md text-sm font-medium">Main Page</a>
				<a href="/know/create" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-stone-700 hover:bg-amber-50 hover:text-amber-700 rounded-md text-sm font-medium">Create</a>
				<a href="/calendar" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-stone-700 hover:bg-amber-50 hover:text-amber-700 rounded-md text-sm font-medium">Calendar</a>
				<a href="/search" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-stone-700 hover:bg-amber-50 hover:text-amber-700 rounded-md text-sm font-medium">Search</a>
				<div class="border-t border-stone-100 my-1"></div>
				<a href="/special/random" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-stone-500 hover:bg-amber-50 hover:text-amber-700 rounded-md text-sm">Random</a>
				<a href="/special/categories" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-stone-500 hover:bg-amber-50 hover:text-amber-700 rounded-md text-sm">Categories</a>
				<a href="/special/stats" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-stone-500 hover:bg-amber-50 hover:text-amber-700 rounded-md text-sm">Stats</a>
				{#if data.user}
					<div class="border-t border-stone-100 my-1"></div>
					<a href="/dashboard" onclick={() => mobileMenuOpen = false} class="block px-3 py-2 text-amber-700 hover:bg-amber-50 rounded-md text-sm font-medium">Dashboard</a>
				{/if}
			</nav>
		</div>
	{/if}

	<!-- Scrollable content area -->
	<main class="flex-1 overflow-y-auto">
		<div class="max-w-4xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
			{@render children()}
		</div>

		<footer class="border-t border-stone-200 bg-white px-4 md:px-6 py-4">
			<div class="max-w-4xl mx-auto text-xs text-stone-400 text-center">
				KnowThing — A collaborative encyclopedia
			</div>
		</footer>
	</main>
</div>
