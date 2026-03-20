<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js';
	import { resolveMagicWord, resolveParserFunction } from '$lib/parser/magic-words.js';
	import { resolveCalendarMagicWord } from '$lib/calendar/magic-words.js';
	import { getRenderContext } from '$lib/renderer/context.js';
	import { detectInfoboxType } from '$lib/infoboxes/detect.js';
	import { buildFieldMap } from '$lib/infoboxes/types.js';
	import type { InfoboxType, FieldMap } from '$lib/infoboxes/types.js';

	// Infobox components — static imports (small components, always needed for a wiki)
	import InfoboxCountry from '$lib/infoboxes/InfoboxCountry.svelte';
	import InfoboxFormerCountry from '$lib/infoboxes/InfoboxFormerCountry.svelte';
	import InfoboxLanguage from '$lib/infoboxes/InfoboxLanguage.svelte';
	import InfoboxSettlement from '$lib/infoboxes/InfoboxSettlement.svelte';
	import InfoboxRoyalty from '$lib/infoboxes/InfoboxRoyalty.svelte';
	import InfoboxOfficeholder from '$lib/infoboxes/InfoboxOfficeholder.svelte';
	import InfoboxPerson from '$lib/infoboxes/InfoboxPerson.svelte';
	import InfoboxReligion from '$lib/infoboxes/InfoboxReligion.svelte';
	import InfoboxGeneric from '$lib/infoboxes/InfoboxGeneric.svelte';

	let { name, args }: { name: string; args: TemplateArg[] } = $props();

	const ctx = getRenderContext();
	const normalizedName = name.trim();
	const lowerName = normalizedName.toLowerCase();

	// ── Dispatch chain ──────────────────────────────────────────────
	// 1. Magic words  ({{PAGENAME}}, {{SITENAME}}, etc.)
	// 2. Parser functions  ({{#if:}}, {{lc:}}, {{#switch:}}, etc.)
	// 3. Infoboxes  ({{Infobox country|...}}) -> typed Svelte components
	// 4. Built-in component templates  (Quote, Navbox, etc.)
	// 5. DB-stored templates  (fetched via context.templates)
	// 6. Fallback: render as unresolved placeholder

	type Resolution =
		| { kind: 'text'; value: string }
		| { kind: 'infobox'; infoboxType: InfoboxType; fields: FieldMap }
		| { kind: 'component'; component: string }
		| { kind: 'unresolved' };

	function resolve(): Resolution {
		// 1. Magic words
		const magicCtx = {
			pageName: ctx.pageName,
			namespace: ctx.namespace
		};
		const magic = resolveMagicWord(normalizedName, args, magicCtx);
		if (magic !== null) return { kind: 'text', value: magic };

		// 1b. Calendar magic words ({{CURRENTYEAR}}, {{CURRENTMONTHNAME}}, etc.)
		const calMagic = resolveCalendarMagicWord(normalizedName, ctx.calendarDate);
		if (calMagic !== null) return { kind: 'text', value: calMagic };

		// 2. Parser functions
		const parserResult = resolveParserFunction(normalizedName, args);
		if (parserResult !== null) return { kind: 'text', value: parserResult };

		// 3. Infoboxes — detect by name prefix "infobox"
		if (lowerName.startsWith('infobox')) {
			const fields = buildFieldMap(args);
			const infoboxType = detectInfoboxType(normalizedName, fields);
			return { kind: 'infobox', infoboxType, fields };
		}

		// 4. Built-in component templates
		if (BUILTIN_TEMPLATES.has(lowerName)) {
			return { kind: 'component', component: lowerName };
		}

		// 5. DB-stored templates (pre-expanded by server, available in context)
		const dbTemplate = ctx.templates?.get(lowerName);
		if (dbTemplate) return { kind: 'text', value: dbTemplate };

		// 6. Fallback
		return { kind: 'unresolved' };
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
		'wt'
	]);

	const resolution = resolve();

	function getArgValue(key: string): string | undefined {
		const arg = args.find((a) => a.name?.toLowerCase().trim() === key.toLowerCase());
		return arg?.value;
	}

	function getPositionalArgs(): string[] {
		return args.filter((a) => !a.name).map((a) => a.value);
	}

	function formatArgs(a: TemplateArg[]): string {
		return a.map((arg) => (arg.name ? `${arg.name}=${arg.value}` : arg.value)).join(' | ');
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
		<blockquote class="know-quote border-l-4 border-stone-300 pl-4 my-4 italic text-stone-700">
			<p>{getPositionalArgs()[0] || getArgValue('text') || ''}</p>
			{#if getArgValue('author') || getPositionalArgs()[1]}
				<footer class="text-sm text-stone-500 mt-1 not-italic">
					— {getArgValue('author') || getPositionalArgs()[1]}
					{#if getArgValue('source') || getPositionalArgs()[2]}
						, <cite>{getArgValue('source') || getPositionalArgs()[2]}</cite>
					{/if}
				</footer>
			{/if}
		</blockquote>
	{:else if resolution.component === 'main' || resolution.component === 'see also'}
		<div class="know-hatnote italic text-sm text-stone-500 mb-4 pl-4">
			{resolution.component === 'main' ? 'Main article' : 'See also'}:
			{#each getPositionalArgs() as page, i}
				{#if i > 0}, {/if}
				<a href="/know/{encodeURIComponent(page.trim())}" class="text-amber-700 hover:underline">{page.trim()}</a>
			{/each}
		</div>
	{:else if resolution.component === 'for'}
		<div class="know-hatnote italic text-sm text-stone-500 mb-4 pl-4">
			For {getPositionalArgs()[0] || ''}, see
			<a href="/know/{encodeURIComponent((getPositionalArgs()[1] || '').trim())}" class="text-amber-700 hover:underline">{(getPositionalArgs()[1] || '').trim()}</a>.
		</div>
	{:else if resolution.component === 'about'}
		<div class="know-hatnote italic text-sm text-stone-500 mb-4 pl-4">
			This article is about {getPositionalArgs()[0] || ''}.
			{#if getPositionalArgs()[1]}
				For {getPositionalArgs()[1]}, see
				<a href="/know/{encodeURIComponent((getPositionalArgs()[2] || getPositionalArgs()[1]).trim())}" class="text-amber-700 hover:underline">{(getPositionalArgs()[2] || getPositionalArgs()[1]).trim()}</a>.
			{/if}
		</div>
	{:else if resolution.component === 'short description'}
		<!-- Short description: metadata only, hidden from view -->
		<meta name="description" content={getPositionalArgs()[0] || ''} />
	{:else if resolution.component === 'cite book' || resolution.component === 'cite web' || resolution.component === 'cite journal'}
		<span class="know-citation text-xs">
			{#if getArgValue('last') || getArgValue('author')}
				{getArgValue('last') || getArgValue('author')}{#if getArgValue('first')}, {getArgValue('first')}{/if}.
			{/if}
			{#if getArgValue('title')}
				<cite class="italic">{getArgValue('title')}</cite>.
			{/if}
			{#if getArgValue('publisher')}
				{getArgValue('publisher')}.
			{/if}
			{#if getArgValue('year') || getArgValue('date')}
				({getArgValue('year') || getArgValue('date')}).
			{/if}
			{#if getArgValue('url')}
				<a href={getArgValue('url')} class="text-amber-700 hover:underline" target="_blank" rel="noopener">[link]</a>
			{/if}
		</span>
	{:else if resolution.component === 'nowrap'}
		<span class="whitespace-nowrap">{getPositionalArgs()[0] || ''}</span>
	{:else if resolution.component === 'small'}
		<small>{getPositionalArgs()[0] || ''}</small>
	{:else if resolution.component === 'big'}
		<big>{getPositionalArgs()[0] || ''}</big>
	{:else if resolution.component === 'sup'}
		<sup>{getPositionalArgs()[0] || ''}</sup>
	{:else if resolution.component === 'sub'}
		<sub>{getPositionalArgs()[0] || ''}</sub>
	{:else if resolution.component === 'clear'}
		<div class="clear-both"></div>
	{:else if resolution.component === 'anchor' || resolution.component === 'visible anchor'}
		<span id={getPositionalArgs()[0] || ''}>{resolution.component === 'visible anchor' ? (getPositionalArgs()[0] || '') : ''}</span>
	{:else if resolution.component === 'color'}
		<span style="color: {getPositionalArgs()[0] || 'inherit'}">{getPositionalArgs()[1] || ''}</span>
	{:else if resolution.component === 'lang'}
		<span lang={getPositionalArgs()[0] || ''}>{getPositionalArgs()[1] || ''}</span>
	{:else if resolution.component === 'legend'}
		<span class="inline-flex items-center gap-1.5 text-sm">
			<span class="inline-block w-3 h-3 rounded-sm" style="background-color: {getPositionalArgs()[0] || '#ccc'}"></span>
			{getPositionalArgs()[1] || ''}
		</span>
	{:else if resolution.component === 'columns'}
		<div class="columns-2 gap-6">
			{getPositionalArgs().join('\n')}
		</div>
	{:else if resolution.component === 'wt'}
		{@const wtWord = getPositionalArgs()[0]?.trim() || ''}
		{@const wtLang = getPositionalArgs()[1]?.trim() || ''}
		{#if wtWord && wtLang}
			<a
				href="/wordbook/{encodeURIComponent(wtLang.toLowerCase())}/{encodeURIComponent(wtWord)}"
				class="italic text-amber-700 hover:text-amber-900 border-b border-dotted border-amber-400 hover:border-amber-700 transition-colors"
				title="{wtWord} ({wtLang})"
			>{wtWord}</a>
		{:else if wtWord}
			<span class="italic text-stone-600">{wtWord}</span>
		{/if}
	{:else if resolution.component === 'sidebar'}
		<div class="know-sidebar float-right ml-4 mb-4 border border-stone-300 bg-stone-50 text-sm w-56 p-3">
			{#if getArgValue('title')}
				<div class="font-bold text-center mb-2 pb-1 border-b border-stone-200">{getArgValue('title')}</div>
			{/if}
			{#each args.filter((a) => a.name && a.name.toLowerCase().trim() !== 'title') as arg}
				<div class="py-0.5 text-stone-700">{arg.value}</div>
			{/each}
		</div>
	{:else}
		<!-- Built-in template not yet rendered: {resolution.component} -->
		<span class="know-template inline-block bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-xs text-amber-800 font-mono">
			{name}{#if args.length > 0}: {formatArgs(args)}{/if}
		</span>
	{/if}
{:else}
	<!-- Unresolved template -->
	<span class="know-template inline-block bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-xs text-red-700 font-mono">
		<a href="/know/Template:{encodeURIComponent(normalizedName)}" class="hover:underline">
			{name}
		</a>
		{#if args.length > 0}: {formatArgs(args)}{/if}
	</span>
{/if}
