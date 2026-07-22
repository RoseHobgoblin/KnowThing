<script lang="ts">
	import { untrack } from 'svelte'
	import { Dialog } from 'bits-ui'
	import { page } from '$app/stores'
	import { mediaLightbox } from './mediaLightbox.svelte.ts'
	import InlineMarkup from '$lib/renderer/InlineMarkup.svelte'
	import CaretLeft from 'phosphor-svelte/lib/CaretLeftIcon'
	import CaretRight from 'phosphor-svelte/lib/CaretRightIcon'

	const current = $derived(mediaLightbox.current)
	const pathname = $derived($page.url.pathname)

	let lastPathname = untrack(() => pathname)
	$effect(() => {
		if (pathname !== lastPathname) {
			lastPathname = pathname
			mediaLightbox.syncFromHash()
		}
	})

	function close() {
		mediaLightbox.close()
	}

	function onbackdropclick(event: MouseEvent) {
		if (event.target === event.currentTarget) close()
	}

	function onkeydown(event: KeyboardEvent) {
		if (!mediaLightbox.hasGallery) return
		if (event.key === 'ArrowRight') {
			event.preventDefault()
			mediaLightbox.next()
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault()
			mediaLightbox.prev()
		}
	}

	function prevImage(event: MouseEvent) {
		event.stopPropagation()
		mediaLightbox.prev()
	}

	function nextImage(event: MouseEvent) {
		event.stopPropagation()
		mediaLightbox.next()
	}

	// Touch swipe to move between gallery images.
	let touchStartX = 0
	let touchStartY = 0
	function ontouchstart(event: TouchEvent) {
		touchStartX = event.changedTouches[0].screenX
		touchStartY = event.changedTouches[0].screenY
	}
	function ontouchend(event: TouchEvent) {
		if (!mediaLightbox.hasGallery) return
		const dx = event.changedTouches[0].screenX - touchStartX
		const dy = event.changedTouches[0].screenY - touchStartY
		// Horizontal swipe, and clearly more horizontal than vertical.
		if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
		if (dx < 0) mediaLightbox.next()
		else mediaLightbox.prev()
	}
</script>

<Dialog.Root bind:open={() => current !== null, (isOpen) => { if (!isOpen) close() }}>
	<Dialog.Portal>
		{#if current}
			<Dialog.Content
				aria-label={current.filename}
				class="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
				onclick={onbackdropclick}
				{onkeydown}
			>
				<div class="flex items-center justify-between px-4 py-2 text-sm text-white/80 border-b border-white/10">
					<span class="font-mono truncate max-w-[60vw]">{current.filename}</span>
					<div class="flex items-center gap-3">
						{#if mediaLightbox.hasGallery}
							<span class="text-xs tabular-nums text-white/60">{mediaLightbox.position} / {mediaLightbox.count}</span>
						{/if}
						<Dialog.Close
							class="p-2 rounded-sm transition-colors hover:bg-white/10"
							aria-label="Close"
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</Dialog.Close>
					</div>
				</div>

				<!-- Backdrop click (close) and swipe (navigate) are enhancements; keyboard
				users get Escape and arrow keys on the dialog itself. -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="flex-1 flex items-center justify-center p-4 overflow-hidden relative"
					onclick={onbackdropclick}
					{ontouchstart}
					{ontouchend}
				>
					{#if mediaLightbox.hasGallery}
						<button
							type="button"
							onclick={prevImage}
							class="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-white/70 rounded-full transition-colors hover:text-white hover:bg-white/10 md:left-4"
							aria-label="Previous image"
						>
							<CaretLeft size={28} weight="bold" />
						</button>
					{/if}

					<img
						src="/api/media/{current.filename}"
						alt={current.alt}
						class="max-w-full max-h-full object-contain"
					/>

					{#if mediaLightbox.hasGallery}
						<button
							type="button"
							onclick={nextImage}
							class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/70 rounded-full transition-colors hover:text-white hover:bg-white/10 md:right-4"
							aria-label="Next image"
						>
							<CaretRight size={28} weight="bold" />
						</button>
					{/if}
				</div>

				<div class="px-4 py-3 text-sm text-white/80 border-t border-white/10 flex items-end justify-between gap-4">
					<div class="flex-1 min-w-0">
						{#if current.caption}
							<div class="text-white"><InlineMarkup text={current.caption} /></div>
						{/if}
					</div>
					<a
						href="/media/{encodeURIComponent(current.filename)}"
						class="shrink-0 text-white/90 underline whitespace-nowrap hover:text-white"
					>
						View file details →
					</a>
				</div>
			</Dialog.Content>
		{/if}
	</Dialog.Portal>
</Dialog.Root>
