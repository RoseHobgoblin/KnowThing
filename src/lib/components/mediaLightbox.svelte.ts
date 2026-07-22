type GalleryItem = {
	filename: string
	alt: string
	caption: string
	/** The trigger element, used to order the gallery by document position. */
	el?: HTMLElement
}

const HASH_REGEX = /^#\/media\/(.+)$/
const MANAGED_STATE = 'knowthing-mediaviewer'

function parseHash(): string | null {
	if (globalThis.window === undefined) return null
	const match = globalThis.location.hash.match(HASH_REGEX)
	return match ? decodeURIComponent(match[1]) : null
}

function pushHash(filename: string) {
	const hash = `#/media/${encodeURIComponent(filename)}`
	if (globalThis.history.state?.knowthing === MANAGED_STATE) {
		globalThis.history.replaceState({ knowthing: MANAGED_STATE }, '', hash)
	} else {
		globalThis.history.pushState({ knowthing: MANAGED_STATE }, '', hash)
	}
}

/** Update the hash in place while stepping through a gallery, so we never pile
 * up one history entry per image. */
function replaceHash(filename: string) {
	if (globalThis.window === undefined) return
	globalThis.history.replaceState({ knowthing: MANAGED_STATE }, '', `#/media/${encodeURIComponent(filename)}`)
}

function clearHash() {
	if (globalThis.history.state?.knowthing === MANAGED_STATE) {
		globalThis.history.back()
	} else {
		globalThis.history.replaceState(null, '', globalThis.location.pathname + globalThis.location.search)
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

	current = $derived(
		this.index >= 0 && this.index < this.items.length
			? this.items[this.index]
			: this.standalone,
	)

	/** 1-based position and total, for the "3 / 12" counter. */
	count = $derived(this.index >= 0 ? this.items.length : (this.standalone ? 1 : 0))
	position = $derived(this.index >= 0 ? this.index + 1 : (this.standalone ? 1 : 0))
	hasGallery = $derived(this.index >= 0 && this.items.length > 1)

	/** Called by each MediaImage on mount. */
	register(item: GalleryItem) {
		this.items.push(item)
		// If a deep link is currently showing this image as a standalone, upgrade
		// it to the gallery now that its element exists.
		if (this.standalone && this.standalone.filename === item.filename) {
			this.sortAndSelect(item.filename)
			this.standalone = null
		}
	}

	unregister(element: HTMLElement) {
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
	}

	private sortAndSelect(filename: string) {
		this.items.sort(inDocumentOrder)
		this.index = this.items.findIndex(it => it.filename === filename)
	}

	open(filename: string, alt = '', caption = '') {
		this.sortAndSelect(filename)
		if (this.index >= 0) {
			this.standalone = null
		} else {
			this.standalone = { filename, alt, caption }
		}
		if (globalThis.window !== undefined) pushHash(filename)
	}

	next() {
		if (!this.hasGallery) return
		this.index = (this.index + 1) % this.items.length
		replaceHash(this.items[this.index].filename)
	}

	prev() {
		if (!this.hasGallery) return
		this.index = (this.index - 1 + this.items.length) % this.items.length
		replaceHash(this.items[this.index].filename)
	}

	close() {
		this.index = -1
		this.standalone = null
		if (globalThis.window !== undefined) clearHash()
	}

	syncFromHash() {
		const filename = parseHash()
		if (filename) {
			if (this.current?.filename === filename) return
			this.sortAndSelect(filename)
			if (this.index === -1) this.standalone = { filename, alt: filename, caption: '' }
			else this.standalone = null
		} else if (this.current) {
			this.index = -1
			this.standalone = null
		}
	}
}

export const mediaLightbox = new MediaLightboxStore()

if (globalThis.window !== undefined) {
	globalThis.addEventListener('hashchange', () => mediaLightbox.syncFromHash())
	globalThis.addEventListener('popstate', () => mediaLightbox.syncFromHash())
	// Initial state on page load (deep links).
	mediaLightbox.syncFromHash()
}
