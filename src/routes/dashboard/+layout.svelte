<script lang="ts">
	import type { LayoutData } from './$types.js';
	import type { Snippet } from 'svelte';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<div class="flex gap-6">
	<!-- Dashboard sidebar -->
	<aside class="w-48 shrink-0 hidden md:block">
		<nav class="bg-white rounded-lg shadow-sm border border-stone-200 p-3 text-sm sticky top-6">
			<div class="font-semibold text-stone-800 mb-3 px-2">Dashboard</div>
			<div class="space-y-0.5">
				<a href="/dashboard" class="block px-2 py-1.5 rounded-md text-stone-600 hover:bg-amber-50 hover:text-amber-700 transition-colors">
					Home
				</a>
				<a href="/dashboard/recent" class="block px-2 py-1.5 rounded-md text-stone-600 hover:bg-amber-50 hover:text-amber-700 transition-colors">
					Recent Changes
				</a>
				<a href="/dashboard/wanted" class="block px-2 py-1.5 rounded-md text-stone-600 hover:bg-amber-50 hover:text-amber-700 transition-colors">
					Wanted Pages
				</a>
				<a href="/dashboard/orphans" class="block px-2 py-1.5 rounded-md text-stone-600 hover:bg-amber-50 hover:text-amber-700 transition-colors">
					Orphaned Pages
				</a>
				<a href="/dashboard/media" class="block px-2 py-1.5 rounded-md text-stone-600 hover:bg-amber-50 hover:text-amber-700 transition-colors">
					Media Library
				</a>
				{#if data.user?.role === 'admin'}
					<div class="border-t border-stone-200 my-2"></div>
					<a href="/dashboard/export" class="block px-2 py-1.5 rounded-md text-stone-600 hover:bg-amber-50 hover:text-amber-700 transition-colors">
						Export Backup
					</a>
				{/if}
			</div>
		</nav>
	</aside>

	<!-- Dashboard content -->
	<div class="flex-1 min-w-0">
		{@render children()}
	</div>
</div>
