<script lang="ts">
	let { tag, language = '' }: { tag: string, language?: string } = $props()
	const href = language
		? `/wordbook/search?tag=${encodeURIComponent(tag)}&language=${encodeURIComponent(language)}`
		: `/wordbook/search?tag=${encodeURIComponent(tag)}`
</script>

<a
	{href}
	class="
		inline-block px-2.5 py-1 rounded-full text-xs bg-raised text-secondary border border-border
		transition-colors
		hover:bg-accent-subtle hover:text-link hover:border-accent-border
	"
>
	{tag}
</a>
