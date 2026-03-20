<script lang="ts">
	let { tag, language = '' }: { tag: string; language?: string } = $props();
	const href = language
		? `/wordbook/search?tag=${encodeURIComponent(tag)}&language=${encodeURIComponent(language)}`
		: `/wordbook/search?tag=${encodeURIComponent(tag)}`;
</script>

<a
	{href}
	class="inline-block px-2.5 py-1 rounded-full text-xs bg-stone-100 text-stone-600 hover:bg-amber-50 hover:text-amber-700 border border-stone-200 hover:border-amber-300 transition-colors"
>
	{tag}
</a>
