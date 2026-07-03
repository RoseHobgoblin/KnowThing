<script lang="ts">
	import type { PlanetModel, StarModel } from './models.js'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	type ContextBody = { id?: number, name: string, slug: string, semiMajorAxisAu?: number | null, bodyType?: string | null }

	let {
		model,
		bodies = [],
		moons = [],
		hz = null,
		selfAu = null,
	}: {
		model: PlanetModel | StarModel
		/** Star: its planets. Planet: its sibling planets. */
		bodies?: ContextBody[]
		/** Planet: its moons. */
		moons?: ContextBody[]
		/** Star: own habitable zone. Planet: parent star's habitable zone. */
		hz?: { inner: number, outer: number } | null
		/** Planet: its own orbital distance, to place it on the bar. */
		selfAu?: number | null
	} = $props()

	const isStar = $derived(model.kind === 'star')

	function inHz(au: number | null | undefined): boolean {
		return hz != null && au != null && au >= hz.inner && au <= hz.outer
	}

	// Log-AU axis spanning every plotted distance (bodies + self + the HZ bounds).
	const axis = $derived.by(() => {
		const aus = [
			...bodies.map(b => b.semiMajorAxisAu).filter((n): n is number => n != null && n > 0),
			...(selfAu != null && selfAu > 0 ? [selfAu] : []),
			...(hz ? [hz.inner, hz.outer] : []),
		]
		if (aus.length === 0) return null
		const min = Math.min(...aus) * 0.6
		const max = Math.max(...aus) * 1.6
		return { min, max, logMin: Math.log(min), logRange: Math.log(max) - Math.log(min) }
	})

	function pos(au: number): number {
		if (!axis || axis.logRange <= 0) return 50
		return Math.max(0, Math.min(100, ((Math.log(au) - axis.logMin) / axis.logRange) * 100))
	}

	const hzBand = $derived(hz && axis ? { left: pos(hz.inner), width: pos(hz.outer) - pos(hz.inner) } : null)

	const dots = $derived([
		...bodies
			.filter(b => b.semiMajorAxisAu != null && b.semiMajorAxisAu > 0)
			.map(b => ({ name: b.name, au: b.semiMajorAxisAu as number, self: false })),
		...(!isStar && selfAu != null && selfAu > 0 ? [{ name: model.name, au: selfAu, self: true }] : []),
	])

	const companionName = $derived(isStar ? ((model as StarModel).companionOf?.name ?? (model as StarModel).companion) : null)
	const companionSlug = $derived(isStar ? ((model as StarModel).companionOf?.slug ?? null) : null)

	function fmtAu(au: number): string {
		return `${au.toLocaleString('en-US', { maximumFractionDigits: au >= 1 ? 2 : 4 })} AU`
	}
</script>

<div class="border border-border-subtle bg-surface">
	<h3 class="text-xs font-semibold uppercase tracking-wider text-faint px-3 py-2 border-b border-border-subtle bg-raised">
		{isStar ? 'System' : 'Position'}
	</h3>
	<div class="p-3 space-y-3 text-sm">
		{#if !isStar && model.kind === 'planet' && model.satelliteOf}
			<div class="flex justify-between gap-4">
				<span class="text-secondary">Orbits</span>
				<a href="/Celestial:{model.satelliteOf.slug}" class="text-link hover:text-link-hover">{model.satelliteOf.name}</a>
			</div>
		{/if}

		<!-- Habitable-zone strip -->
		{#if hzBand}
			<div>
				<div class="flex items-center justify-between text-xs text-faint mb-1">
					<span>Habitable zone</span>
					<span>{hz!.inner.toFixed(2)}–{hz!.outer.toFixed(2)} AU</span>
				</div>
				<div class="relative h-7 bg-raised border border-border-subtle overflow-hidden">
					<div
						class="absolute inset-y-0 bg-accent/15 border-x border-accent/40"
						style="left:{hzBand.left}%;width:{hzBand.width}%;"
						title="Habitable zone"
					></div>
					{#each dots as dot (dot.name)}
						<div
							class="absolute top-1/2 -translate-1/2 rounded-full {dot.self ? 'bg-accent size-2.5 ring-2 ring-accent/30' : 'bg-secondary size-2'}"
							style="left:{pos(dot.au)}%;"
							title="{dot.name} — {fmtAu(dot.au)}"
						></div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Related bodies -->
		{#if bodies.length > 0}
			<div class="space-y-0.5">
				<div class="text-xs text-faint uppercase tracking-wider">{isStar ? 'Planets' : 'Siblings'}</div>
				{#each bodies as body (body.slug)}
					<a href="/Celestial:{body.slug}" class="flex items-center justify-between gap-3 px-1.5 py-1 transition-colors hover:bg-raised">
						<span class="text-body truncate">{body.name}</span>
						<span class="flex items-center gap-2 shrink-0 text-xs">
							{#if inHz(body.semiMajorAxisAu)}
								<span class="text-accent">HZ</span>
							{/if}
							{#if body.semiMajorAxisAu != null}
								<span class="text-faint tabular-nums">{fmtAu(body.semiMajorAxisAu)}</span>
							{/if}
						</span>
					</a>
				{/each}
			</div>
		{/if}

		<!-- Moons (planet) -->
		{#if moons.length > 0}
			<div class="space-y-0.5">
				<div class="text-xs text-faint uppercase tracking-wider">Moons</div>
				{#each moons as moon (moon.slug)}
					<a href="/Celestial:{moon.slug}" class="block px-1.5 py-1 text-secondary text-xs transition-colors hover:bg-raised hover:text-body">{moon.name}</a>
				{/each}
			</div>
		{/if}

		<!-- Companion (star) -->
		{#if companionName}
			<div class="flex justify-between gap-4">
				<span class="text-secondary shrink-0">Companion</span>
				{#if companionSlug}
					<a href="/Celestial:{companionSlug}" class="text-link hover:text-link-hover text-right">{companionName}</a>
				{:else}
					<span class="text-body text-right min-w-0"><InlineMarkup text={companionName} /></span>
				{/if}
			</div>
		{/if}

		{#if isStar && bodies.length === 0 && !companionName}
			<p class="text-faint text-xs">No planets or companions catalogued yet.</p>
		{/if}
	</div>
</div>
