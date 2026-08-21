<script lang="ts">
	import type { WikiNode } from '$lib/parser/types.js'
	import WikiNodeSelf from './WikiNode.svelte'
	import WikiHeading from './nodes/WikiHeading.svelte'
	import WikiParagraph from './nodes/WikiParagraph.svelte'
	import WikiBold from './nodes/WikiBold.svelte'
	import WikiItalic from './nodes/WikiItalic.svelte'
	import WikiStrikethrough from './nodes/WikiStrikethrough.svelte'
	import WikiSubscript from './nodes/WikiSubscript.svelte'
	import WikiSuperscript from './nodes/WikiSuperscript.svelte'
	import WikiUnorderedList from './nodes/WikiUnorderedList.svelte'
	import WikiOrderedList from './nodes/WikiOrderedList.svelte'
	import WikiDefinitionList from './nodes/WikiDefinitionList.svelte'
	import WikiInternalLink from './nodes/WikiInternalLink.svelte'
	import WikiWordbookLink from './nodes/WikiWordbookLink.svelte'
	import WikiDomainLink from './nodes/WikiDomainLink.svelte'
	import WikiNamespaceLink from './nodes/WikiNamespaceLink.svelte'
	import WikiExternalLink from './nodes/WikiExternalLink.svelte'
	import WikiTemplate from './nodes/WikiTemplate.svelte'
	import WikiImage from './nodes/WikiImage.svelte'
	import WikiTable from './nodes/WikiTable.svelte'
	import WikiReference from './nodes/WikiReference.svelte'
	import WikiReferenceList from './nodes/WikiReferenceList.svelte'
	import WikiHatnote from './nodes/WikiHatnote.svelte'
	import WikiCollapse from './nodes/WikiCollapse.svelte'
	import WikiCodeBlock from './nodes/WikiCodeBlock.svelte'
	import WikiNavbox from './nodes/WikiNavbox.svelte'
	import WikiGallery from './nodes/WikiGallery.svelte'
	import WikiNoWiki from './nodes/WikiNoWiki.svelte'
	import WikiPreformatted from './nodes/WikiPreformatted.svelte'

	let { node }: { node: WikiNode } = $props()
</script>

{#if node.type === 'document'}
	{#each node.children as child, index (index)}
		<WikiNodeSelf node={child} />
	{/each}
{:else if node.type === 'heading'}
	<WikiHeading level={node.level} children={node.children} />
{:else if node.type === 'paragraph'}
	<WikiParagraph children={node.children} />
{:else if node.type === 'bold'}
	<WikiBold children={node.children} />
{:else if node.type === 'italic'}
	<WikiItalic children={node.children} />
{:else if node.type === 'strikethrough'}
	<WikiStrikethrough children={node.children} />
{:else if node.type === 'subscript'}
	<WikiSubscript children={node.children} />
{:else if node.type === 'superscript'}
	<WikiSuperscript children={node.children} />
{:else if node.type === 'unordered_list'}
	<WikiUnorderedList items={node.items} />
{:else if node.type === 'ordered_list'}
	<WikiOrderedList items={node.items} />
{:else if node.type === 'definition_list'}
	<WikiDefinitionList items={node.items} />
{:else if node.type === 'internal_link'}
	<WikiInternalLink target={node.target} display={node.display} />
{:else if node.type === 'wordbook_link'}
	<WikiWordbookLink {node} />
{:else if node.type === 'domain_link'}
	<WikiDomainLink {node} />
{:else if node.type === 'namespace_link'}
	<WikiNamespaceLink {node} />
{:else if node.type === 'external_link'}
	<WikiExternalLink url={node.url} display={node.display} />
{:else if node.type === 'template'}
	<WikiTemplate name={node.name} args={node.args} />
{:else if node.type === 'image'}
	<WikiImage filename={node.filename} options={node.options} />
{:else if node.type === 'table'}
	<WikiTable attrs={node.attrs} rows={node.rows} />
{:else if node.type === 'category'}
	<!-- Categories rendered separately in CategoryBar -->
{:else if node.type === 'reference'}
	<WikiReference content={node.content} />
{:else if node.type === 'reference_list'}
	<WikiReferenceList />
{:else if node.type === 'hatnote'}
	<WikiHatnote content={node.content} />
{:else if node.type === 'collapse'}
	<WikiCollapse title={node.title} content={node.content} />
{:else if node.type === 'code_block'}
	<WikiCodeBlock lang={node.lang} code={node.code} />
{:else if node.type === 'navbox'}
	<WikiNavbox title={node.title} groups={node.groups} />
{:else if node.type === 'gallery'}
	<WikiGallery items={node.items} />
{:else if node.type === 'nowiki'}
	<WikiNoWiki text={node.text} />
{:else if node.type === 'horizontal_rule'}
	<hr class="know-hr my-4 border-border-strong" />
{:else if node.type === 'preformatted'}
	<WikiPreformatted text={node.text} />
{:else if node.type === 'text'}
	{node.text}
{:else if node.type === 'line_break'}
	<br />
{/if}
