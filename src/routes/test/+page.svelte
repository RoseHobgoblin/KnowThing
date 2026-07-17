<script lang="ts">
	import { parseWikitext } from '$lib/parser/index.js'
	import WikiNode from '$lib/renderer/WikiNode.svelte'
	import { createKnowContext } from '$lib/renderer/context.js'

	// Set up wiki render context with hardcoded test links
	createKnowContext({
		resolvedLinks: new Map([
			['know:onchera', { href: '/know/onchera', exists: true }],
			['know:amalur', { href: '/know/amalur', exists: true }],
			['know:oncheran_language', { href: '/know/oncheran_language', exists: true }],
			['know:batzar_nagusia', { href: '/know/batzar_nagusia', exists: true }],
		]),
		mediaBaseUrl: '/api/media',
		pageBaseUrl: '/know',
	})

	const sampleWikitext = `== State of Onchera ==

The '''State of Onchera''' (''Ontsserako Demeta'' in [[Oncheran language|Oncheran]]) is a sovereign country located in the western regions of the continent.

=== Government ===

Onchera is governed as a federal theocratic parliamentary monarchy under a ceremonial hereditary military dictatorship. The [[Batzar Nagusia]] serves as the national legislature.

=== Geography ===

The capital city is [[Amalur]], located on the northern coast.

* Northern highlands
* Central plains
* Southern archipelago

{| class="wikitable"
|-
! Region !! Capital !! Population
|-
| Northern Highlands || [[Amalur]] || 30,000,000
|-
| Central Plains || Etxea || 45,000,000
|-
| Southern Islands || Itsasoa || 25,000,000
|}

; Official languages : [[Oncheran language|Oncheran]], Great Tambuli
; Religion : 72.1% Oncheran religion, 20.0% Tanism

=== References ===

The country has a rich history<ref>Historical Atlas of Onchera, 3rd Edition</ref> dating back millennia<ref>Ancient Records, Temple Archives</ref>.

<references/>

----

''This article is a stub. You can help by expanding it.''

{{Infobox country|name=State of Onchera|capital=Amalur|population=~100,000,000}}

Some ~~deprecated~~ information was removed.

Visit [https://example.com the official site] for more.

<nowiki>This '''won't''' be parsed as [[bold]] or a link.</nowiki>

 This is preformatted text
 with multiple lines preserved.

<syntaxhighlight lang="python">
def greet(name):
    print(f"Hello, {name}!")
</syntaxhighlight>

[[Category:Countries]]
[[Category:Monarchies]]`

	const ast = parseWikitext(sampleWikitext)
</script>

<div class="max-w-4xl mx-auto p-8">
	<h1 class="text-3xl font-bold mb-6 border-b-2 border-heading pb-2">
		Parser Test Page
	</h1>

	<div class="know-article">
		<WikiNode node={ast} />
	</div>

	<details class="mt-12">
		<summary class="bg-raised px-4 py-2 cursor-pointer font-mono text-sm">AST Debug Output</summary>
		<pre class="p-4 text-xs overflow-auto max-h-96 bg-page">{JSON.stringify(ast, null, 2)}</pre>
	</details>
</div>
