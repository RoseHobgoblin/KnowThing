<script lang="ts">
	import type { LayoutData } from './$types.js'
	import type { Snippet } from 'svelte'

	let { children, data }: { children: Snippet, data: LayoutData } = $props()
</script>

<div class="flex gap-6">
	<!-- Dashboard sidebar -->
	<aside class="w-48 shrink-0 hidden md:block">
		<nav class="bg-surface rounded-lg shadow-sm border border-border p-3 text-sm sticky top-6">
			<div class="font-semibold text-body mb-3 px-2">Dashboard</div>
			<div class="space-y-0.5">
				<a href="/dashboard" class="
					block px-2 py-1.5 rounded-md text-secondary transition-colors
					hover:bg-accent-subtle hover:text-link
				">
					Home
				</a>
				<a href="/dashboard/recent" class="
					block px-2 py-1.5 rounded-md text-secondary transition-colors
					hover:bg-accent-subtle hover:text-link
				">
					Recent Changes
				</a>
				<a href="/dashboard/wanted" class="
					block px-2 py-1.5 rounded-md text-secondary transition-colors
					hover:bg-accent-subtle hover:text-link
				">
					Wanted Pages
				</a>
				<a href="/dashboard/orphans" class="
					block px-2 py-1.5 rounded-md text-secondary transition-colors
					hover:bg-accent-subtle hover:text-link
				">
					Orphaned Pages
				</a>
				<a href="/dashboard/media" class="
					block px-2 py-1.5 rounded-md text-secondary transition-colors
					hover:bg-accent-subtle hover:text-link
				">
					Media Library
				</a>
				{#if data.user?.role === 'admin'}
					<div class="border-t border-border my-2"></div>
					<a href="/dashboard/calendar" class="
						block px-2 py-1.5 rounded-md text-secondary transition-colors
						hover:bg-accent-subtle hover:text-link
					">
						Calendars
					</a>
					<a href="/dashboard/users" class="
						block px-2 py-1.5 rounded-md text-secondary transition-colors
						hover:bg-accent-subtle hover:text-link
					">
						Users
					</a>
					<a href="/dashboard/settings" class="
						block px-2 py-1.5 rounded-md text-secondary transition-colors
						hover:bg-accent-subtle hover:text-link
					">
						Site Settings
					</a>
					<a href="/dashboard/export" class="
						block px-2 py-1.5 rounded-md text-secondary transition-colors
						hover:bg-accent-subtle hover:text-link
					">
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
