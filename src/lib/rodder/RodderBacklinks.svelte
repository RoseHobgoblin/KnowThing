<script lang="ts">
	type Backlink = { slug: string, title: string | null, domain: string }

	let { links = [] }: { links?: Backlink[] } = $props()

	// Know lives in the bare/default namespace at /know/<slug>; every other domain
	// follows the MediaWiki-style Domain:Title convention (e.g. /Calendar:<slug>).
	function href(link: Backlink): string {
		if (link.domain === 'know') return `/know/${link.slug}`
		const namespace = link.domain.charAt(0).toUpperCase() + link.domain.slice(1)
		return `/${namespace}:${link.slug}`
	}
</script>

{#if links.length > 0}
	<div class="bg-surface">
		<h3 class="text-xs font-semibold uppercase tracking-wider text-secondary px-3 py-2 border-b border-border-subtle bg-raised">
			Referenced by
		</h3>
		<ul>
			{#each links as link (link.domain + ':' + link.slug)}
				<li class="border-b border-border-subtle/40 last:border-0">
					<a
						href={href(link)}
						class="flex items-center justify-between gap-3 px-3 py-1.5 text-sm transition-colors hover:bg-raised"
					>
						<span class="text-link truncate hover:text-link-hover">{link.title ?? link.slug}</span>
						{#if link.domain !== 'know'}
							<span class="shrink-0 text-xs uppercase tracking-wider text-secondary">{link.domain}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
