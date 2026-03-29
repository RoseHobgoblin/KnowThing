<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'

	let { ast }: { ast: WikiNode } = $props()

	interface TocEntry {
		level: number
		text: string
		id: string
	}

	function extractHeadings(node: WikiNode): TocEntry[] {
		const entries: TocEntry[] = []
		if (node.type === 'document') {
			for (const child of node.children) {
				if (child.type === 'heading') {
					const text = extractText(child.children)
					const id = text.replaceAll(/\s+/g, '_').replaceAll(/[^\w\-]/g, '')
					entries.push({ level: child.level, text, id })
				}
			}
		}
		return entries
	}

	function extractText(nodes: WikiNode[]): string {
		return nodes
			.map((n) => {
				if (n.type === 'text') return n.text
				if ('children' in n && Array.isArray(n.children)) return extractText(n.children)
				if (n.type === 'internal_link') return n.display ? extractText(n.display) : n.target
				return ''
			})
			.join('')
	}

	const headings = $derived(extractHeadings(ast))
	const show = $derived(headings.length >= 3)

	let activeId = $state('')
	let tocOpen = $state(false)

	$effect(() => {
		if (!show) return

		const ids = headings.map(h => h.id)
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = entry.target.id
						break
					}
				}
			},
			{ rootMargin: '-80px 0px -70% 0px', threshold: 0 }
		)

		// Observe heading elements in the article
		for (const id of ids) {
			const element = document.querySelector(`#${CSS.escape(id)}`)
			if (element) observer.observe(element)
		}

		return () => observer.disconnect()
	})
</script>

{#if show}
	<!-- Desktop: sticky sidebar TOC in left gutter -->
	<nav
		class="
			fixed top-32 hidden w-48 max-h-[calc(100vh-10rem)] overflow-y-auto
			text-xs
			xl:block
		"
		style="left: max(1rem, calc((100vw - 56rem) / 2 - 13rem))"
	>
		<div class="border-l-2 border-accent-border pl-3">
			<div class="font-semibold text-secondary mb-2 uppercase tracking-wider" style="font-size: 0.65rem">
				Sections
			</div>
			<ol class="space-y-0.5">
				{#each headings as h}
					<li style="padding-left: {(h.level - 2) * 10}px">
						<a
							href="#{h.id}"
							class="
								block py-0.5 leading-tight transition-colors duration-150
								{activeId === h.id
									? 'text-link font-medium'
									: 'text-dim hover:text-secondary'}
							"
						>{h.text}</a>
					</li>
				{/each}
			</ol>
		</div>
	</nav>

	<!-- Mobile/tablet: floating toggle button + dropdown -->
	<div class="xl:hidden mb-4">
		<button
			onclick={() => tocOpen = !tocOpen}
			class="
				flex items-center gap-1.5 text-xs text-secondary font-medium
				border border-border px-3 py-1.5 bg-surface shadow-sm
				transition-colors hover:text-link hover:border-accent-border
			"
		>
			<svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h14" />
			</svg>
			Sections
			<svg
				class="size-3 transition-transform {tocOpen ? 'rotate-180' : ''}"
				fill="none" stroke="currentColor" viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if tocOpen}
			<nav class="mt-2 border border-border bg-surface shadow-sm p-3">
				<ol class="space-y-0.5 text-sm">
					{#each headings as h}
						<li style="padding-left: {(h.level - 2) * 16}px">
							<a
								href="#{h.id}"
								onclick={() => tocOpen = false}
								class="
									block py-0.5 transition-colors
									{activeId === h.id
										? 'text-link font-medium'
										: 'text-secondary hover:text-link'}
								"
							>{h.text}</a>
						</li>
					{/each}
				</ol>
			</nav>
		{/if}
	</div>
{/if}
