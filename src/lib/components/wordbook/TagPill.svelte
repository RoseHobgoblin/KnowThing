<script lang="ts">
	let { tag, language = '' }: { tag: string, language?: string } = $props()
	const href = $derived.by(() => language
		? `/search?scope=wordbook&tag=${encodeURIComponent(tag)}&language=${encodeURIComponent(language)}`
		: `/search?scope=wordbook&tag=${encodeURIComponent(tag)}`)
</script>

<a
	{href}
	class="
		inline-block px-2.5 py-1 text-xs bg-raised text-secondary
		transition-colors
		hover:bg-accent-subtle hover:text-link
	"
>
	{tag}
</a>
