<script lang="ts">
	let { lang, code }: { lang: string | null, code: string } = $props()
</script>

<pre class="
	know-code-block bg-page p-3 my-2 overflow-x-auto text-sm
	font-mono
"><code class={lang ? `language-${lang}` : ''}>{code}</code></pre>
