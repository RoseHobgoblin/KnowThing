import { untrack } from 'svelte'
import { browser } from '$app/environment'
import { pushState, replaceState } from '$app/navigation'

type GalleryItem = {
	filename: string
	alt: string
	caption: string
	/** The trigger element, used to order the gallery by document position. */
	el?: HTMLElement
}

const HASH_REGEX = /^#\/media\/(.+)$/

/** Deep-link hash for an image, e.g. `#/media/Foo%20bar.png`. */
export function mediaHash(filename: string): string {
	return `#/media/${encodeURIComponent(filename)}`
}

/** Filename encoded in a `#/media/...` hash, or null if this isn't one. */
export function parseMediaHash(hash: string): string | null {
	const match = hash.match(HASH_REGEX)
	if (!match) return null
	try {
		return decodeURIComponent(match[1])
	} catch {
		return null
	}
}

function inDocumentOrder(a: GalleryItem, b: GalleryItem): number {
	if (!a.el || !b.el) return 0
	const pos = a.el.compareDocumentPosition(b.el)
	if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1
	if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1
	return 0
}

class MediaLightboxStore {
	/** Every linkable image currently mounted, in the order they registered. */
	private items = $state<GalleryItem[]>([])
	/** Index into `items` when viewing a gallery image, else -1. */
	index = $state(-1)
	/** Fallback shown when the open image isn't a registered gallery member
	 * (e.g. a deep link opened before its image mounted). */
	private standalone = $state<GalleryItem | null>(null)
	/** Alt/caption for the image being opened, used only if it turns out not to
	 * be a registered gallery member. */
	private pending: GalleryItem | null = null
	/** True while the open viewer owns a history entry we pushed, so closing can
	 * pop it instead of leaving a dead entry behind. */
	private ownsHistoryEntry = false

	current = $derived(
		this.index >= 0 && this.index < this.items.length
			? this.items[this.index]
			: this.standalone,
	)

	/** 1-based position and total, for the "3 / 12" counter. */
	count = $derived(this.index >= 0 ? this.items.length : (this.standalone ? 1 : 0))
	position = $derived(this.index >= 0 ? this.index + 1 : (this.standalone ? 1 : 0))
	hasGallery = $derived(this.index >= 0 && this.items.length > 1)

	// `register`/`unregister`/`sync` all read `items` and write it back, and every
	// caller is inside an `$effect` — so they run untracked, or each write would
	// re-dirty the effect that made it and spin forever.

	/** Called by each MediaImage on mount. */
	register(item: GalleryItem) {
		untrack(() => {
			this.items.push(item)
			// If a deep link is currently showing this image as a standalone, upgrade
			// it to the gallery now that its element exists.
			if (this.standalone && this.standalone.filename === item.filename) {
				this.sortAndSelect(item.filename)
				this.standalone = null
			}
		})
	}

	unregister(element: HTMLElement) {
		untrack(() => {
			const index = this.items.findIndex(it => it.el === element)
			if (index === -1) return
			const removed = this.items[index]
			this.items.splice(index, 1)
			// Keep the viewer pointed at the same image if the list shifted under it.
			if (this.index >= 0 && this.current) {
				const stillOpen = this.items.findIndex(it => it.filename === this.current?.filename && it.filename !== removed.filename)
				this.index = stillOpen === -1 ? Math.min(this.index, this.items.length - 1) : stillOpen
				if (this.items.length === 0) this.index = -1
			}
		})
	}

	private sortAndSelect(filename: string) {
		this.items = this.items.toSorted(inDocumentOrder)
		this.index = this.items.findIndex(it => it.filename === filename)
	}

	/**
	 * Point the viewer at `filename` (or close it for null). Driven exclusively by
	 * `page.state.media`, which SvelteKit restores on back/forward — so history
	 * and the visible image can never disagree.
	 */
	sync(filename: string | null) {
		untrack(() => {
			if (filename === null) {
				this.ownsHistoryEntry = false
				this.pending = null
				this.index = -1
				this.standalone = null
				return
			}
			this.sortAndSelect(filename)
			if (this.index >= 0) {
				this.standalone = null
			} else {
				this.standalone = this.pending?.filename === filename
					? this.pending
					: { filename, alt: filename, caption: '' }
			}
		})
	}

	/** Show `filename`, adding a history entry so Back closes the viewer. */
	open(filename: string, alt = '', caption = '') {
		this.pending = { filename, alt, caption }
		if (!browser) return
		this.ownsHistoryEntry = true
		pushState(mediaHash(filename), { media: filename })
	}

	next() {
		this.step(1)
	}

	prev() {
		this.step(-1)
	}

	/** Step through the gallery in place, so we never pile up one history entry
	 * per image. */
	private step(delta: number) {
		if (!this.hasGallery || !browser) return
		const target = this.items[(this.index + delta + this.items.length) % this.items.length]
		this.pending = null
		replaceState(mediaHash(target.filename), { media: target.filename })
	}

	close() {
		if (!browser) {
			this.sync(null)
			return
		}
		if (this.ownsHistoryEntry) {
			this.ownsHistoryEntry = false
			// Popping our own entry restores the pre-viewer state; `sync` closes us.
			globalThis.history.back()
			return
		}
		// Deep link — there's no entry of ours to pop, so drop the hash in place.
		const { pathname, search } = globalThis.location
		replaceState(pathname + search, {})
	}

	/**
	 * Adopt a `#/media/...` deep link on first load by moving it into SvelteKit's
	 * page state, so the viewer opens and closes like a normally-opened one.
	 */
	adoptHash() {
		if (!browser) return
		const filename = parseMediaHash(globalThis.location.hash)
		if (!filename) return
		this.ownsHistoryEntry = false
		replaceState(mediaHash(filename), { media: filename })
	}
}

export const mediaLightbox = new MediaLightboxStore()
