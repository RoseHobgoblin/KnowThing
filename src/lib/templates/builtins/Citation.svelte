<script lang="ts">
	import type { TemplateArg } from '$lib/parser/types.js'
	import { namedArg, namedArgAny } from '../args.js'

	let { args }: { args: TemplateArg[] } = $props()

	const last = $derived(namedArg(args, 'last'))
	const first = $derived(namedArg(args, 'first'))
	const author = $derived(namedArg(args, 'author'))
	const title = $derived(namedArg(args, 'title'))
	const publisher = $derived(namedArg(args, 'publisher'))
	const journal = $derived(namedArg(args, 'journal'))
	const volume = $derived(namedArg(args, 'volume'))
	const issue = $derived(namedArg(args, 'issue'))
	const pages = $derived(namedArgAny(args, 'pages', 'page'))
	const date = $derived(namedArgAny(args, 'date', 'year'))
	const url = $derived(namedArg(args, 'url'))
	const accessdate = $derived(namedArgAny(args, 'access-date', 'accessdate'))
	const doi = $derived(namedArg(args, 'doi'))
	const isbn = $derived(namedArg(args, 'isbn'))

	const byline = $derived((last || author) ? `${last || author}${first ? `, ${first}` : ''}` : null)
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
