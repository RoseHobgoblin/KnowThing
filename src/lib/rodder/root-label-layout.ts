export type RootLabelOccupancy = { x: number, y: number }

export type RootLabelPlacement = {
	x: number
	y: number
	pillar: { x: number, fromY: number, toY: number }
}

const LABEL_HEIGHT_PX = 14
const LABEL_GAP_PX = 8
const LABEL_TIER_PX = 15
const LABEL_COLLISION_HALF_WIDTH_PX = 54
const VIEWPORT_INSET_PX = 4

function collides(x: number, y: number, occupied: RootLabelOccupancy[]): boolean {
	return occupied.some(label =>
		Math.abs(label.x - x) < LABEL_COLLISION_HALF_WIDTH_PX
		&& Math.abs(label.y - y) < LABEL_TIER_PX,
	)
}

/**
 * Place a root-object label on a vertical leader. Clustered screen positions
 * receive distinct tiers instead of losing all but the first label.
 */
export function placeRootLabel(
	anchorX: number,
	anchorY: number,
	extentPx: number,
	viewportHeight: number,
	occupied: RootLabelOccupancy[],
): RootLabelPlacement {
	const safeExtent = Math.max(0, extentPx)
	let y = anchorY - safeExtent - LABEL_GAP_PX - LABEL_HEIGHT_PX
	while (y >= VIEWPORT_INSET_PX && collides(anchorX, y, occupied)) y -= LABEL_TIER_PX

	if (y >= VIEWPORT_INSET_PX) {
		return {
			x: anchorX,
			y,
			pillar: {
				x: anchorX,
				fromY: anchorY - safeExtent,
				toY: y + LABEL_HEIGHT_PX,
			},
		}
	}

	y = anchorY + safeExtent + LABEL_GAP_PX
	const maximumY = Math.max(VIEWPORT_INSET_PX, viewportHeight - LABEL_HEIGHT_PX - VIEWPORT_INSET_PX)
	while (y <= maximumY && collides(anchorX, y, occupied)) y += LABEL_TIER_PX
	y = Math.min(y, maximumY)
	return {
		x: anchorX,
		y,
		pillar: {
			x: anchorX,
			fromY: anchorY + safeExtent,
			toY: y,
		},
	}
}
