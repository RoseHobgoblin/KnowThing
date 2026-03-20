<script lang="ts">
	let { name, slug, nativeName, family, script, color = '#d97706', wordCount = 0 }: {
		name: string;
		slug: string;
		nativeName?: string | null;
		family?: string | null;
		script?: string | null;
		color?: string;
		wordCount?: number;
	} = $props();
</script>

<a
	href="/wordbook/{slug}"
	class="block bg-white rounded-lg border border-stone-200 hover:border-amber-300 hover:shadow-md transition-all overflow-hidden group"
>
	<div class="h-1.5" style="background-color: {color};"></div>
	<div class="p-4">
		<div class="flex items-baseline gap-2 mb-1">
			<h3 class="font-semibold text-stone-900 group-hover:text-amber-700 transition-colors">{name}</h3>
			{#if nativeName}
				<span class="text-sm text-stone-400 italic">{nativeName}</span>
			{/if}
		</div>

		<div class="flex items-center gap-3 text-xs text-stone-500 mt-2">
			{#if family}
				<span>{family}</span>
			{/if}
			{#if script}
				<span class="text-stone-300">·</span>
				<span>{script} script</span>
			{/if}
		</div>

		<div class="mt-3 text-sm font-medium" style="color: {color};">
			{wordCount} {wordCount === 1 ? 'word' : 'words'}
		</div>
	</div>
</a>
