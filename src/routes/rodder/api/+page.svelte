<script lang="ts">
	import { resolve } from '$app/paths'
	import ArticleShell from '$lib/components/ArticleShell.svelte'

	const entityExample = `const response = await fetch('/api/rodder/orison-fold')
if (!response.ok) throw new Error('Rodder entity unavailable')
const document = await response.json()

console.log(document.authored.physical.massKg)
console.log(document.resolved.facts.model.status)
console.log(document.displays.rootMap?.apparentSky.sources)`

	const embedExample = `{{Root map|orison-fold
 |mode=orrery
 |focus=nacre
 |selected=sky:glasswake
 |labels=major
 |sky_labels=all
 |visibility=physical
 |interaction=locked
 |time=on
 |speed=100
 |controls=hide
}}

{{Sector map|palimpsest-reach
 |focus=orison-fold
 |selected=glasswake
 |interaction=inspect
}}`

	const interactionRows = [
		['locked', 'Fixed composition; hover and the full-view link remain available.'],
		['inspect', 'Fixed camera and display with selection, inspection, and entity navigation.'],
		['explore', 'Camera, time, display settings, selection, navigation, and compact controls.'],
	]
</script>

<svelte:head>
	<title>Rodder Consumer API — KnowThing</title>
	<meta name="description" content="Live Rodder entity and sector documents, schemas, Wiki embeds, and projection helpers." />
</svelte:head>

<ArticleShell breadcrumbs={[{ label: 'Rodder', href: resolve('/rodder') }, { label: 'Consumer API' }]} title="Rodder Consumer API">
	{#snippet actions()}
		<a href={resolve('/api/rodder/schema?download=1')} class="text-link transition-colors hover:text-link-hover" download>Download schemas</a>
	{/snippet}

	<div class="max-w-5xl space-y-8">
		<p class="max-w-3xl text-secondary">
			Rodder publishes live, JSON-safe documents rather than renderer-specific database rows. Authored facts, normalized or derived values, and illustrative display projections remain visibly separate.
		</p>

		<section class="space-y-3">
			<h2 class="text-xl font-semibold text-heading">Documents</h2>
			<div class="grid gap-3 md:grid-cols-2">
				<div class="border border-border-subtle bg-surface p-4">
					<h3 class="font-semibold text-heading">Entity document</h3>
					<code class="mt-1 block text-sm text-accent">GET /api/rodder/:slug</code>
					<p class="mt-2 text-sm text-secondary">Identity, canonical links, authored content and extensions, hierarchy, placement, normalized facts, root-map members, apparent sky, calendars, capabilities, and scoped diagnostics.</p>
					<div class="mt-3 flex gap-3 text-sm">
						<a href={resolve('/api/rodder/[slug]', { slug: 'orison-fold' })} class="text-link hover:text-link-hover">Open example</a>
						<a href={resolve('/api/rodder/[slug]?download=1', { slug: 'orison-fold' })} class="text-link hover:text-link-hover" download>Download example</a>
					</div>
				</div>
				<div class="border border-border-subtle bg-surface p-4">
					<h3 class="font-semibold text-heading">Sector document</h3>
					<code class="mt-1 block text-sm text-accent">GET /api/rodder/sectors/:slug</code>
					<p class="mt-2 text-sm text-secondary">The complete coordinate frame, origin, extent, positioned and unpositioned roots, bounds, provenance, links, capabilities, and diagnostics.</p>
					<div class="mt-3 flex gap-3 text-sm">
						<a href={resolve('/api/rodder/sectors/[slug]', { slug: 'palimpsest-reach' })} class="text-link hover:text-link-hover">Open example</a>
						<a href={resolve('/api/rodder/sectors/[slug]?download=1', { slug: 'palimpsest-reach' })} class="text-link hover:text-link-hover" download>Download example</a>
					</div>
				</div>
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-xl font-semibold text-heading">Source-aware values</h2>
			<p class="max-w-3xl text-sm text-secondary"><code>authored</code> contains stored statements exactly as authored. <code>resolved.facts</code> wraps normalized values with <code>authored</code>, <code>derived</code>, <code>illustrative</code>, or <code>unavailable</code> status and a source. <code>displays</code> contains explicit renderer projections; consumers remain free to ignore them.</p>
			<pre class="overflow-x-auto border border-border-subtle bg-page p-4 text-xs text-body"><code>{entityExample}</code></pre>
		</section>

		<section class="space-y-3">
			<h2 class="text-xl font-semibold text-heading">Wiki embeds</h2>
			<p class="max-w-3xl text-sm text-secondary">Named arguments are readable composition. A validated URL-encoded <code>view=</code> payload can seed a complete copied view, and named arguments override it individually. Root playback speed is measured in simulated days per real second.</p>
			<pre class="overflow-x-auto border border-border-subtle bg-page p-4 text-xs text-body"><code>{embedExample}</code></pre>
			<div class="overflow-x-auto">
				<table class="w-full border-collapse text-left text-sm">
					<thead><tr class="border-b border-border-subtle text-secondary"><th class="p-2">Preset</th><th class="p-2">Behavior</th></tr></thead>
					<tbody>
						{#each interactionRows as row (row[0])}
							<tr class="border-b border-border-subtle"><td class="p-2 font-mono text-accent">{row[0]}</td><td class="p-2 text-secondary">{row[1]}</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<section class="space-y-3">
			<h2 class="text-xl font-semibold text-heading">Infobox projections</h2>
			<p class="max-w-3xl text-sm text-secondary">Wiki authors continue to use <code>&#123;&#123;Infobox star|from=slug&#125;&#125;</code>, <code>&#123;&#123;Infobox planet|from=slug&#125;&#125;</code>, and <code>&#123;&#123;Infobox system|from=slug&#125;&#125;</code>. Internally, <code>rodderDocumentInfoboxFields(document)</code> projects the public document into the established snake-case field map. It performs no database lookup and intentionally ignores nested extension objects that cannot become a meaningful text row.</p>
		</section>

		<section class="border border-accent-border bg-accent-subtle p-4 text-sm">
			<h2 class="font-semibold text-heading">Machine-readable schemas</h2>
			<p class="mt-1 text-secondary">The schema bundle covers entity documents, sector documents, view state, display configuration, diagnostics, and interaction policy.</p>
			<div class="mt-2 flex gap-3"><a href={resolve('/api/rodder/schema')} class="text-link hover:text-link-hover">Open schemas</a><a href={resolve('/api/rodder/schema?download=1')} class="text-link hover:text-link-hover" download>Download schemas</a></div>
		</section>
	</div>
</ArticleShell>
