const BASE_Z = 9998

const stack = $state<symbol[]>([])

export function pushDialog(id: symbol): void {
	if (!stack.includes(id)) stack.push(id)
}

export function popDialog(id: symbol): void {
	const index = stack.indexOf(id)
	if (index !== -1) stack.splice(index, 1)
}

export function getOverlayZ(id: symbol): number {
	const depth = stack.indexOf(id)
	return BASE_Z + (depth === -1 ? 0 : depth * 2)
}

export function getContentZ(id: symbol): number {
	return getOverlayZ(id) + 1
}

export function isTopmost(id: symbol): boolean {
	return stack.length > 0 && stack.at(-1) === id
}
