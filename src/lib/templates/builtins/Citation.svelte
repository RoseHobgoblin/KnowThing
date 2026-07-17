<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArg, namedArgAny } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()

	const last = namedArg(args, 'last')
	const first = namedArg(args, 'first')
	const author = namedArg(args, 'author')
	const title = namedArg(args, 'title')
	const publisher = namedArg(args, 'publisher')
	const journal = namedArg(args, 'journal')
	const volume = namedArg(args, 'volume')
	const issue = namedArg(args, 'issue')
	const pages = namedArgAny(args, 'pages', 'page')
	const date = namedArgAny(args, 'date', 'year')
	const url = namedArg(args, 'url')
	const accessdate = namedArgAny(args, 'access-date', 'accessdate')
	const doi = namedArg(args, 'doi')
	const isbn = namedArg(args, 'isbn')

	const byline = (last || author) ? `${last || author}${first ? `, ${first}` : ''}` : null
</script>

<span class="know-citation text-xs">
	{#if byline}{byline}.{/if}
	{#if title}<cite class="italic">{title}</cite>.{/if}
	{#if journal}<span class="italic">{journal}</span>{#if volume} <strong>{volume}</strong>{/if}{#if issue}({issue}){/if}{#if pages}: {pages}{/if}.{/if}
	{#if publisher && !journal}{publisher}.{/if}
	{#if date}({date}).{/if}
	{#if doi}doi:<a href="https://doi.org/{doi}" class="text-link hover:underline" target="_blank" rel="noopener">{doi}</a>.{/if}
	{#if isbn}ISBN {isbn}.{/if}
	{#if url}<a href={url} class="text-link hover:underline" target="_blank" rel="noopener">[link]</a>{/if}
	{#if accessdate} <span class="text-secondary">(accessed {accessdate})</span>{/if}
</span>
