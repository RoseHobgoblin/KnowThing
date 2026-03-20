<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { resolveMagicWord, resolveParserFunction } from '$lib/parser/magic-words.js'
	import { resolveCalendarMagicWord } from '$lib/calendar/magic-words.js'
	import { getRenderContext } from '$lib/renderer/context.js'
	import { detectInfoboxType } from '$lib/infoboxes/detect.js'
	import { buildFieldMap } from '$lib/infoboxes/types.js'
	import type { InfoboxType, FieldMap } from '$lib/infoboxes/types.js'

	// Infobox components — static imports (small components, always needed for a wiki)
	import InfoboxCountry from '$lib/infoboxes/InfoboxCountry.svelte'
	import InfoboxFormerCountry from '$lib/infoboxes/InfoboxFormerCountry.svelte'
	import InfoboxLanguage from '$lib/infoboxes/InfoboxLanguage.svelte'
	import InfoboxSettlement from '$lib/infoboxes/InfoboxSettlement.svelte'
	import InfoboxRoyalty from '$lib/infoboxes/InfoboxRoyalty.svelte'
	import InfoboxOfficeholder from '$lib/infoboxes/InfoboxOfficeholder.svelte'
	import InfoboxPerson from '$lib/infoboxes/InfoboxPerson.svelte'
	import InfoboxReligion from '$lib/infoboxes/InfoboxReligion.svelte'
	import InfoboxGeneric from '$lib/infoboxes/InfoboxGeneric.svelte'

	let { name, args }: { name: string, args: TemplateArg[] } = $props()

	const ctx = getRenderContext()
	const normalizedName = name.trim()
	const lowerName = normalizedName.toLowerCase()

	// ── Dispatch chain ──────────────────────────────────────────────
	// 1. Magic words  ({{PAGENAME}}, {{SITENAME}}, etc.)
	// 2. Parser functions  ({{#if:}}, {{lc:}}, {{#switch:}}, etc.)
	// 3. Infoboxes  ({{Infobox country|...}}) -> typed Svelte components
	// 4. Built-in component templates  (Quote, Navbox, etc.)
	// 5. DB-stored templates  (fetched via context.templates)
	// 6. Fallback: render as unresolved placeholder

	type Resolution =
		| { kind: 'text', value: string }
		| { kind: 'infobox', infoboxType: InfoboxType, fields: FieldMap }
		| { kind: 'component', component: string }
		| { kind: 'unresolved' }

	function resolve(): Resolution {
		// 1. Magic words
		const magicCtx = {
			pageName: ctx.pageName,
			namespace: ctx.namespace,
		}
		const magic = resolveMagicWord(normalizedName, args, magicCtx)
		if (magic !== null) return { kind: 'text', value: magic }

		// 1b. Calendar magic words ({{CURRENTYEAR}}, {{CURRENTMONTHNAME}}, etc.)
		const calMagic = resolveCalendarMagicWord(normalizedName, ctx.calendarDate)
		if (calMagic !== null) return { kind: 'text', value: calMagic }

		// 2. Parser functions
		const parserResult = resolveParserFunction(normalizedName, args)
		if (parserResult !== null) return { kind: 'text', value: parserResult }

		// 3. Infoboxes — detect by name prefix "infobox"
		if (lowerName.startsWith('infobox')) {
			const fields = buildFieldMap(args)
			const infoboxType = detectInfoboxType(normalizedName, fields)
			return { kind: 'infobox', infoboxType, fields }
		}

		// 4. Built-in component templates
		if (BUILTIN_TEMPLATES.has(lowerName)) {
			return { kind: 'component', component: lowerName }
		}

		// 5. DB-stored templates (pre-expanded by server, available in context)
		const dbTemplate = ctx.templates?.get(lowerName)
		if (dbTemplate) return { kind: 'text', value: dbTemplate }

		// 6. Fallback
		return { kind: 'unresolved' }
	}

	const BUILTIN_TEMPLATES = new Set([
		'quote',
		'main',
		'see also',
		'for',
		'about',
		'short description',
		'sidebar',
		'columns',
		'legend',
		'color',
		'flag',
		'lang',
		'convert',
		'date',
		'age',
		'nowrap',
		'small',
		'big',
		'sup',
		'sub',
		'clear',
		'anchor',
		'visible anchor',
		'refn',
		'efn',
		'notelist',
		'sfn',
		'cite book',
		'cite web',
		'cite journal',
		'wt',
	])

	const resolution = resolve()

	function getArgumentValue(key: string): string | undefined {
		const argument = args.find(a => a.name?.toLowerCase().trim() === key.toLowerCase())
		return argument?.value
	}

	function getPositionalArguments(): string[] {
		return args.filter(a => !a.name).map(a => a.value)
	}

	function formatArguments(a: TemplateArg[]): string {
		return a.map(argument => (argument.name ? `${argument.name}=${argument.value}` : argument.value)).join(' | ')
	}
</script>

{#if resolution.kind === 'text'}
	{resolution.value}
{:else if resolution.kind === 'infobox'}
	{#if resolution.infoboxType === 'country'}
		<InfoboxCountry fields={resolution.fields} />
	{:else if resolution.infoboxType === 'former_country'}
		<InfoboxFormerCountry fields={resolution.fields} />
	{:else if resolution.infoboxType === 'language'}
		<InfoboxLanguage fields={resolution.fields} />
	{:else if resolution.infoboxType === 'settlement'}
		<InfoboxSettlement fields={resolution.fields} />
	{:else if resolution.infoboxType === 'royalty'}
		<InfoboxRoyalty fields={resolution.fields} />
	{:else if resolution.infoboxType === 'officeholder'}
		<InfoboxOfficeholder fields={resolution.fields} />
	{:else if resolution.infoboxType === 'person'}
		<InfoboxPerson fields={resolution.fields} />
	{:else if resolution.infoboxType === 'religion'}
		<InfoboxReligion fields={resolution.fields} />
	{:else}
		<InfoboxGeneric fields={resolution.fields} />
	{/if}
{:else if resolution.kind === 'component'}
	{#if resolution.component === 'quote'}
		<blockquote class="know-quote border-l-4 border-border-strong pl-4 my-4 italic text-secondary">
			<p>{getPositionalArguments()[0] || getArgumentValue('text') || ''}</p>
			{#if getArgumentValue('author') || getPositionalArguments()[1]}
				<footer class="text-sm text-dim mt-1 not-italic">
					— {getArgumentValue('author') || getPositionalArguments()[1]}
					{#if getArgumentValue('source') || getPositionalArguments()[2]}
						, <cite>{getArgumentValue('source') || getPositionalArguments()[2]}</cite>
					{/if}
				</footer>
			{/if}
		</blockquote>
	{:else if resolution.component === 'main' || resolution.component === 'see also'}
		<div class="know-hatnote italic text-sm text-dim mb-4 pl-4">
			{resolution.component === 'main' ? 'Main article' : 'See also'}:
			{#each getPositionalArguments() as page, index}
				{#if index > 0}, {/if}
				<a href="/know/{encodeURIComponent(page.trim())}" class="text-link hover:underline">{page.trim()}</a>
			{/each}
		</div>
	{:else if resolution.component === 'for'}
		<div class="know-hatnote italic text-sm text-dim mb-4 pl-4">
			For {getPositionalArguments()[0] || ''}, see
			<a href="/know/{encodeURIComponent((getPositionalArguments()[1] || '').trim())}" class="text-link hover:underline">{(getPositionalArguments()[1] || '').trim()}</a>.
		</div>
	{:else if resolution.component === 'about'}
		<div class="know-hatnote italic text-sm text-dim mb-4 pl-4">
			This article is about {getPositionalArguments()[0] || ''}.
			{#if getPositionalArguments()[1]}
				For {getPositionalArguments()[1]}, see
				<a href="/know/{encodeURIComponent((getPositionalArguments()[2] || getPositionalArguments()[1]).trim())}" class="text-link hover:underline">{(getPositionalArguments()[2] || getPositionalArguments()[1]).trim()}</a>.
			{/if}
		</div>
	{:else if resolution.component === 'short description'}
		<!-- Short description: metadata only, hidden from view -->
		<meta name="description" content={getPositionalArguments()[0] || ''} />
	{:else if resolution.component === 'cite book' || resolution.component === 'cite web' || resolution.component === 'cite journal'}
		<span class="know-citation text-xs">
			{#if getArgumentValue('last') || getArgumentValue('author')}
				{getArgumentValue('last') || getArgumentValue('author')}{#if getArgumentValue('first')}, {getArgumentValue('first')}{/if}.
			{/if}
			{#if getArgumentValue('title')}
				<cite class="italic">{getArgumentValue('title')}</cite>.
			{/if}
			{#if getArgumentValue('publisher')}
				{getArgumentValue('publisher')}.
			{/if}
			{#if getArgumentValue('year') || getArgumentValue('date')}
				({getArgumentValue('year') || getArgumentValue('date')}).
			{/if}
			{#if getArgumentValue('url')}
				<a href={getArgumentValue('url')} class="text-link hover:underline" target="_blank" rel="noopener">[link]</a>
			{/if}
		</span>
	{:else if resolution.component === 'nowrap'}
		<span class="whitespace-nowrap">{getPositionalArguments()[0] || ''}</span>
	{:else if resolution.component === 'small'}
		<small>{getPositionalArguments()[0] || ''}</small>
	{:else if resolution.component === 'big'}
		<big>{getPositionalArguments()[0] || ''}</big>
	{:else if resolution.component === 'sup'}
		<sup>{getPositionalArguments()[0] || ''}</sup>
	{:else if resolution.component === 'sub'}
		<sub>{getPositionalArguments()[0] || ''}</sub>
	{:else if resolution.component === 'clear'}
		<div class="clear-both"></div>
	{:else if resolution.component === 'anchor' || resolution.component === 'visible anchor'}
		<span id={getPositionalArguments()[0] || ''}>{resolution.component === 'visible anchor' ? (getPositionalArguments()[0] || '') : ''}</span>
	{:else if resolution.component === 'color'}
		<span style="color: {getPositionalArguments()[0] || 'inherit'}">{getPositionalArguments()[1] || ''}</span>
	{:else if resolution.component === 'lang'}
		<span lang={getPositionalArguments()[0] || ''}>{getPositionalArguments()[1] || ''}</span>
	{:else if resolution.component === 'legend'}
		<span class="inline-flex items-center gap-1.5 text-sm">
			<span class="inline-block size-3 rounded-sm" style="background-color: {getPositionalArguments()[0] || '#ccc'}"></span>
			{getPositionalArguments()[1] || ''}
		</span>
	{:else if resolution.component === 'columns'}
		<div class="columns-2 gap-6">
			{getPositionalArguments().join('\n')}
		</div>
	{:else if resolution.component === 'wt'}
		{@const wtWord = getPositionalArguments()[0]?.trim() || ''}
		{@const wtLang = getPositionalArguments()[1]?.trim() || ''}
		{#if wtWord && wtLang}
			<a
				href="/wordbook/{encodeURIComponent(wtLang.toLowerCase())}/{encodeURIComponent(wtWord)}"
				class="
					italic text-link border-b border-dotted border-accent-border transition-colors
					hover:text-link-hover hover:border-accent-hover
				"
				title="{wtWord} ({wtLang})"
			>{wtWord}</a>
		{:else if wtWord}
			<span class="italic text-secondary">{wtWord}</span>
		{/if}
	{:else if resolution.component === 'sidebar'}
		<div class="know-sidebar float-right ml-4 mb-4 border border-border-strong bg-page text-sm w-56 p-3">
			{#if getArgumentValue('title')}
				<div class="font-bold text-center mb-2 pb-1 border-b border-border">{getArgumentValue('title')}</div>
			{/if}
			{#each args.filter(a => a.name && a.name.toLowerCase().trim() !== 'title') as argument}
				<div class="py-0.5 text-secondary">{argument.value}</div>
			{/each}
		</div>
	{:else}
		<!-- Built-in template not yet rendered: {resolution.component} -->
		<span class="
			know-template inline-block bg-accent-subtle border border-accent-border rounded-sm px-1.5 py-0.5 text-xs
			text-accent-text font-mono
		">
			{name}{#if args.length > 0}: {formatArguments(args)}{/if}
		</span>
	{/if}
{:else}
	<!-- Unresolved template -->
	<span class="
		know-template inline-block bg-red-50 border border-red-200 rounded-sm px-1.5 py-0.5 text-xs
		text-red-700 font-mono
	">
		<a href="/know/Template:{encodeURIComponent(normalizedName)}" class="hover:underline">
			{name}
		</a>
		{#if args.length > 0}: {formatArguments(args)}{/if}
	</span>
{/if}
