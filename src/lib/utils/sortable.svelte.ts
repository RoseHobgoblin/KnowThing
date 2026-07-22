import { SvelteMap } from 'svelte/reactivity'
import { draggable, type DragOptions } from '@neodrag/svelte'

type SortableOptions = {
	/** Called after a completed drag with the source and target indices. */
	onReorder: (from: number, to: number) => void
	/** Selector for the drag handle within the item (default: the whole item). */
	handle?: string
	/** Selector for descendants that must not start a drag (e.g. 'button'). */
	cancel?: string
	axis?: 'x' | 'y' | 'both'
	disabled?: boolean
}

/** Sortable-list behavior on top of @neodrag/svelte, which only provides
 * positional dragging. Register each list item with `use:sortable.item={index}`;
 * the target slot is hit-tested against sibling rects from the pointer position,
 * and the dragged item snaps back on release (the caller's reorder re-renders
 * the list in its new order). */
export function createSortable(options: SortableOptions) {
	let dragIndex = $state<number | null>(null)
	let overIndex = $state<number | null>(null)

	const nodes = new SvelteMap<HTMLElement, number>()
	let draggedNode: HTMLElement | null = null

	function targetIndex(event: PointerEvent): number | null {
		for (const [node, index] of nodes) {
			if (node === draggedNode) continue
			const r = node.getBoundingClientRect()
			if (
				event.clientX >= r.left && event.clientX <= r.right
				&& event.clientY >= r.top && event.clientY <= r.bottom
			) return index
		}
		return null
	}

	function item(node: HTMLElement, index: number) {
		nodes.set(node, index)
		if (!options.disabled) node.style.touchAction = 'none'

		let position = { x: 0, y: 0 }
		const buildOptions = (): DragOptions => ({
			position,
			handle: options.handle,
			cancel: options.cancel,
			axis: options.axis ?? 'both',
			disabled: options.disabled,
			onDragStart: () => {
				draggedNode = node
				dragIndex = nodes.get(node) ?? null
			},
			onDrag: (data) => {
				position = { x: data.offsetX, y: data.offsetY }
				overIndex = targetIndex(data.event)
			},
			onDragEnd: (data) => {
				const from = nodes.get(node)
				const to = targetIndex(data.event)
				draggedNode = null
				dragIndex = null
				overIndex = null
				position = { x: 0, y: 0 }
				instance?.update?.(buildOptions())
				if (from != null && to != null && to !== from) options.onReorder(from, to)
			},
		})
		const instance = draggable(node, buildOptions()) as
			{ update?: (options: DragOptions) => void, destroy?: () => void } | undefined

		return {
			update(newIndex: number) {
				nodes.set(node, newIndex)
			},
			destroy() {
				nodes.delete(node)
				instance?.destroy?.()
			},
		}
	}

	return {
		item,
		get dragIndex() { return dragIndex },
		get overIndex() { return overIndex },
	}
}
