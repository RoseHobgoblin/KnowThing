<script lang="ts">
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import type { TemplateArg } from '$lib/parser/types.js'
	import { positionalArg } from '../args.js'
	import { getKnowContext } from '$lib/renderer/context.js'
	import SectorMapView from '$lib/feature/rodder/SectorMap.svelte'
	import { resolveSectorMapEmbedConfiguration } from '$lib/feature/rodder/embed-config.js'
	import { rodderViewUrl, type SectorCameraState, type SectorViewState } from '$lib/feature/rodder/view-state.js'
	import type { SectorRootView } from '$lib/feature/rodder/sector-view.js'

	let { args }: { args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const slug = $derived(positionalArg(args, 0)?.trim() || '')
	const document = $derived(slug ? ctx.rodderSectors?.get(slug) : null)
	const pageHref = $derived(document
		? resolve('/rodder/sector/[slug]', { slug: document.identity.slug })
		: '')
	const roots = $derived((document?.displays.sectorMap.roots ?? []) as SectorRootView[])
	const config = $derived(document
		? resolveSectorMapEmbedConfiguration(args, document.identity.slug, roots.map(root => root.slug))
		: null)
	let selected = $derived<string | null>(config?.selected ?? null)
	let host = $state<HTMLElement | null>(null)
	let active = $state(false)
	let map = $state<{ getCameraState(): SectorCameraState | null } | null>(null)

	onMount(() => {
		if (!host || typeof IntersectionObserver === 'undefined') {
			active = true
			return
		}
		const observer = new IntersectionObserver((entries) => {
			if (entries.some(entry => entry.isIntersecting)) {
				active = true
				observer.disconnect()
			}
		}, { rootMargin: '400px' })
		observer.observe(host)
		return () => observer.disconnect()
	})

	function openFullView(event: MouseEvent) {
		if (!document || !config) return
		const camera = map?.getCameraState() ?? config.camera
		if (!camera) return
		event.preventDefault()
		const state: SectorViewState = {
			version: 1,
			renderer: 'sector',
			space: { slug: document.identity.slug },
			selected,
			focus: config.focus,
			camera,
		}
		location.assign(rodderViewUrl(new URL(pageHref, location.origin), state))
	}
</script>

{#if document && config}
	<figure class="my-4 overflow-hidden border border-border-subtle bg-surface" bind:this={host}>
		<div class="relative min-h-64 w-full bg-black" style:aspect-ratio={String(config.aspectRatio)}>
			{#if active}
				<SectorMapView
					bind:this={map}
					sectorName={document.identity.name}
					sectorSlug={document.identity.slug}
					units={document.frame.units}
					{roots}
					bind:selectedSlug={selected}
					focusSlug={config.focus}
					initialCameraState={config.camera}
					interaction={config.interaction}
				/>
			{:else}
				<div class="absolute inset-0 grid place-items-center p-5 text-center text-sm text-secondary">
					<span>Interactive map of {document.identity.name} loads when it approaches the viewport.</span>
				</div>
			{/if}
		</div>

		{#if config.errors.length > 0}
			<ul class="border-t border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">
				{#each config.errors as issue (`${issue.argument}:${issue.message}`)}
					<li><code>{issue.argument}</code>: {issue.message}</li>
				{/each}
			</ul>
		{/if}

		<noscript>
			<div class="border-t border-border-subtle p-3 text-sm text-secondary">
				Interactive rendering requires JavaScript. <a class="text-link" href={resolve('/rodder/sector/[slug]', { slug: document.identity.slug })}>Open {document.identity.name}</a>.
			</div>
		</noscript>

		<figcaption class="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-3 py-2 text-xs text-secondary">
			<span>{document.identity.name} · {document.resolved.positionedRootCount} positioned · {document.resolved.unpositionedRootCount} unavailable</span>
			{#if config.interaction.objectNavigation}
				<a href={resolve('/rodder/sector/[slug]', { slug: document.identity.slug })} onclick={openFullView} class="text-link hover:text-link-hover">Open full viewer</a>
			{/if}
		</figcaption>
	</figure>
{:else}
	<div class="my-4 border border-error-border bg-error-bg p-4 text-sm text-error-text" role="status">
		Sector map target <code>{slug || '?'}</code> is missing or was not prefetched.
	</div>
{/if}
