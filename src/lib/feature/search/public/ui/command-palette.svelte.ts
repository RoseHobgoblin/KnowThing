/** Global open-state for the command palette, so the Ctrl/⌘-K handler, the
 * header button, and the palette itself all share one source of truth. */
class CommandPaletteStore {
	open = $state(false)

	toggle() {
		this.open = !this.open
	}

	show() {
		this.open = true
	}

	close() {
		this.open = false
	}
}

export const commandPalette = new CommandPaletteStore()
