<script lang="ts">
	let { name, slug, color }: { name: string, slug: string, color?: string | null } = $props()
	const c = color || '#d97706'
</script>

<a
	href="/wordbook/{slug}"
	class="
		inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors
		hover:opacity-80
	"
	style="background-color: {c}15; color: {c}; border: 1px solid {c}30;"
>
	<span class="size-1.5 rounded-full" style="background-color: {c};"></span>
	{name}
</a>
