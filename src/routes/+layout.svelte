<script lang="ts">
	import '../app.css';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: any; data: LayoutData } = $props();
</script>

<div class="h-screen flex flex-col bg-stone-50 overflow-hidden">
	<!-- Amber accent strip -->
	<div class="h-1 bg-amber-500 shrink-0"></div>

	<!-- Header -->
	<header class="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between shrink-0">
		<a href="/" class="text-xl font-bold text-stone-900 tracking-tight hover:text-amber-700 transition-colors">
			Know<span class="text-amber-600">Thing</span>
		</a>

		<div class="flex-1 max-w-md mx-8">
			<SearchBar />
		</div>

		<nav class="flex items-center gap-4 text-sm">
			{#if data.user}
				<span class="text-stone-500">{data.user.username}</span>
				<form method="POST" action="/auth/logout">
					<button type="submit" class="text-amber-700 hover:text-amber-900 hover:underline transition-colors">Log out</button>
				</form>
			{:else}
				<a href="/auth/login" class="text-amber-700 hover:text-amber-900 hover:underline transition-colors">Log in</a>
				<a href="/auth/register" class="px-3 py-1.5 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors">Register</a>
			{/if}
		</nav>
	</header>

	<!-- Horizontal navigation -->
	<nav class="bg-white border-b border-stone-200 px-6 shadow-sm shrink-0">
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

	<!-- Scrollable content area — only this scrolls -->
	<main class="flex-1 overflow-y-auto">
		<div class="max-w-4xl mx-auto w-full px-6 py-8">
			{@render children()}
		</div>

		<!-- Footer -->
		<footer class="border-t border-stone-200 bg-white px-6 py-4">
			<div class="max-w-4xl mx-auto text-xs text-stone-400 text-center">
				KnowThing — A collaborative encyclopedia
			</div>
		</footer>
	</main>
</div>
