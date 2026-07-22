<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { resolveMagicWord, resolveParserFunction } from '$lib/parser/magic-words.js'
	import { resolveCalendarMagicWord } from 'rimecraft'
	import { getKnowContext } from '$lib/renderer/context.js'
	import { detectInfoboxType } from '$lib/infoboxes/detect.js'
	import { buildFieldMap } from '$lib/infoboxes/types.js'
	import type { InfoboxType, FieldMap } from '$lib/infoboxes/types.js'
	import { BUILTIN_TEMPLATES, type BuiltinEntry } from '$lib/templates/registry.js'
	import { formatArgs } from '$lib/templates/args.js'
	import { SvelteMap } from 'svelte/reactivity'

	import { INFOBOX_ENTRIES } from '$lib/infoboxes/registry.js'
	import { genericSchema } from '$lib/infoboxes/schemas/generic.js'
	import InfoboxRenderer from '$lib/infoboxes/InfoboxRenderer.svelte'

	let { name, args }: { name: string, args: TemplateArg[] } = $props()

	const ctx = getKnowContext()
	const normalizedName = $derived(name.trim())
	const lowerName = $derived(normalizedName.toLowerCase())

	// Dispatch chain:
	//   1. Magic words ({{PAGENAME}}, {{CURRENTYEAR}}, …)
	//   2. Parser functions ({{#if:}}, {{lc:}}, …)
	//   3. Infoboxes ({{Infobox <type>|…}}) → typed Svelte component
	//   4. Built-in templates (registry-driven, see $lib/templates)
	//   5. DB-stored templates (pre-expanded server-side, in ctx.templates)
	//   6. Fallback placeholder

	type Resolution =
		| { kind: 'text', value: string }
		| { kind: 'infobox', infoboxType: InfoboxType, fields: FieldMap }
		| { kind: 'builtin', entry: BuiltinEntry }
		| { kind: 'unresolved' }

	function resolve(): Resolution {
		const magic = resolveMagicWord(normalizedName, args, { pageName: ctx.pageName, namespace: ctx.namespace })
		if (magic !== null) return { kind: 'text', value: magic }

		const calMagic = resolveCalendarMagicWord(normalizedName, ctx.calendarDate)
		if (calMagic !== null) return { kind: 'text', value: calMagic }

		const parserResult = resolveParserFunction(normalizedName, args)
		if (parserResult !== null) return { kind: 'text', value: parserResult }

		if (lowerName.startsWith('infobox')) {
			let fields = buildFieldMap(args)
			const fromSlug = fields.get('from')
			if (fromSlug && ctx.structuredData?.has(fromSlug)) {
				const dbFields = ctx.structuredData.get(fromSlug)!
				fields = new SvelteMap([...dbFields, ...fields])
				fields.delete('from')
			}
			return { kind: 'infobox', infoboxType: detectInfoboxType(normalizedName, fields), fields }
		}

		const builtin = BUILTIN_TEMPLATES[lowerName]
		if (builtin) return { kind: 'builtin', entry: builtin }

		const dbTemplate = ctx.templates?.get(lowerName)
		if (dbTemplate) return { kind: 'text', value: dbTemplate }

		return { kind: 'unresolved' }
	}

	const resolution = $derived(resolve())
</script>

{#if resolution.kind === 'text'}
	{resolution.value}
{:else if resolution.kind === 'infobox'}
	{@const entry = INFOBOX_ENTRIES[resolution.infoboxType]}
	{#if entry?.kind === 'schema'}
		<InfoboxRenderer schema={entry.schema} fields={resolution.fields} />
	{:else if entry?.kind === 'component'}
		{@const InfoboxComponent = entry.component}
		<InfoboxComponent fields={resolution.fields} />
	{:else}
		<InfoboxRenderer schema={genericSchema} fields={resolution.fields} />
	{/if}
{:else if resolution.kind === 'builtin'}
	{@const Comp = resolution.entry.component}
	<Comp {args} {...resolution.entry.staticProps ?? {}} />
{:else}
	<span class="
		know-template inline-block bg-error-bg border border-error-border px-1.5 py-0.5 text-xs
		text-error-text font-mono
	">
		<a href="/know/Template:{encodeURIComponent(normalizedName)}" class="hover:underline">{name}</a>
		{#if args.length > 0}: {formatArgs(args)}{/if}
	</span>
{/if}
