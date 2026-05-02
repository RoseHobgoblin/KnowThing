<script lang="ts">
	import { page } from '$app/stores'
	import { mediaLightbox } from './mediaLightbox.svelte.ts'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'

	const current = $derived(mediaLightbox.current)
	const pathname = $derived($page.url.pathname)

	let lastPathname = pathname
	$effect(() => {
		if (pathname !== lastPathname) {
			lastPathname = pathname
			mediaLightbox.syncFromHash()
		}
	})

	function close() {
		mediaLightbox.close()
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && current) {
			event.preventDefault()
			close()
		}
	}

	function onbackdropclick(event: MouseEvent) {
		if (event.target === event.currentTarget) close()
	}
</script>

<svelte:window {onkeydown} />

{#if current}
	<div
		role="dialog"
		aria-modal="true"
		aria-label={current.filename}
		class="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
		onclick={onbackdropclick}
	>
		<div class="flex items-center justify-between px-4 py-2 text-sm text-white/80 border-b border-white/10">
			<span class="font-mono truncate max-w-[60vw]">{current.filename}</span>
			<button
				type="button"
				onclick={close}
				class="p-2 hover:bg-white/10 rounded transition-colors"
				aria-label="Close"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		<div class="flex-1 flex items-center justify-center p-4 overflow-hidden" onclick={onbackdropclick}>
			<img
				src="/api/media/{current.filename}"
				alt={current.alt}
				class="max-w-full max-h-full object-contain"
			/>
		</div>

		<div class="px-4 py-3 text-sm text-white/80 border-t border-white/10 flex items-end justify-between gap-4">
			<div class="flex-1 min-w-0">
				{#if current.caption}
					<div class="text-white"><InlineMarkup text={current.caption} /></div>
				{/if}
			</div>
			<a
				href="/media/{encodeURIComponent(current.filename)}"
				class="shrink-0 text-white/90 hover:text-white underline whitespace-nowrap"
			>
				View file details →
			</a>
		</div>
	</div>
{/if}
