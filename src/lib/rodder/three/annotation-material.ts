import {
	AdditiveBlending,
	SpriteMaterial,
	type ColorRepresentation,
	type Texture,
} from 'three'

/**
 * Interface annotations keep their authored colour independent of scene
 * exposure. They may identify a physical object, but they are not luminous
 * scene geometry.
 */
export function createOverviewMarkerMaterial(map: Texture, color: ColorRepresentation): SpriteMaterial {
	return new SpriteMaterial({
		map,
		color,
		transparent: true,
		opacity: 0.9,
		toneMapped: false,
		// A marker may assist a subpixel body, but must still disappear behind
		// foreground stars and planets already present in the depth buffer.
		depthTest: true,
		depthWrite: false,
	})
}

/**
 * An authored remote star is unresolved in the local-system view. Its point
 * spread is a display transfer function, not a light-emitting scene object,
 * and therefore remains independent of local-system exposure.
 */
export function createApparentSkyPointMaterial(map: Texture, color: ColorRepresentation): SpriteMaterial {
	return new SpriteMaterial({
		map,
		color,
		transparent: true,
		blending: AdditiveBlending,
		depthTest: true,
		depthWrite: false,
		toneMapped: false,
	})
}
