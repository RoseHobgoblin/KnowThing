type LightboxState = {
	filename: string
	alt: string
	caption: string
}

const HASH_REGEX = /^#\/media\/(.+)$/
const MANAGED_STATE = 'knowthing-mediaviewer'

function parseHash(): string | null {
	if (typeof window === 'undefined') return null
	const match = window.location.hash.match(HASH_REGEX)
	return match ? decodeURIComponent(match[1]) : null
}

function setHash(filename: string) {
	const hash = `#/media/${encodeURIComponent(filename)}`
	if (window.history.state?.knowthing === MANAGED_STATE) {
		window.history.replaceState({ knowthing: MANAGED_STATE }, '', hash)
	} else {
		window.history.pushState({ knowthing: MANAGED_STATE }, '', hash)
	}
}

function clearHash() {
	if (window.history.state?.knowthing === MANAGED_STATE) {
		window.history.back()
	} else {
		window.history.replaceState(null, '', window.location.pathname + window.location.search)
	}
}

class MediaLightboxStore {
	current = $state<LightboxState | null>(null)

	open(filename: string, alt = '', caption = '') {
		this.current = { filename, alt, caption }
		if (typeof window !== 'undefined') setHash(filename)
	}

	close() {
		this.current = null
		if (typeof window !== 'undefined') clearHash()
	}

	syncFromHash() {
		const filename = parseHash()
		if (filename) {
			if (this.current?.filename !== filename) {
				this.current = { filename, alt: filename, caption: '' }
			}
		} else if (this.current) {
			this.current = null
		}
	}
}

export const mediaLightbox = new MediaLightboxStore()

if (typeof window !== 'undefined') {
	window.addEventListener('hashchange', () => mediaLightbox.syncFromHash())
	window.addEventListener('popstate', () => mediaLightbox.syncFromHash())
	// Initial state on page load (deep links).
	mediaLightbox.syncFromHash()
}
