import {
	AdditiveBlending,
	Color,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	RingGeometry,
	Sprite,
	SpriteMaterial,
	Vector3,
	type SphereGeometry,
	type Texture,
} from 'three'
import { rotatePerifocalToInertial } from 'tungolcraft'
import { physicalBodyExtent, physicalBodyRadius } from '../body-sizing.js'
import { resolveColor, spectralColor } from '../colors.js'
import type { MapBody } from '../system-layout.js'

export type BodyVisual = {
	anchor: Group
	tiltGroup: Group
	spinGroup: Group
	mesh: Mesh
	radius: number
	extent: number
	getScreenExtentPx(): number
	setWorldUnitsPerPixel(worldUnitsPerPixel: number): void
	setSelected(selected: boolean, related: boolean): void
	setDay(day: number | null): void
	dispose(): void
}

export function createBodyVisual(args: {
	body: MapBody
	isStar: boolean
	isSatellite: boolean
	sphereGeometry: SphereGeometry
	glowTexture: Texture
	markerTexture: Texture
	selectionTexture: Texture
	selectionColor: string
	worldUnitsPerAu: number
}): BodyVisual {
	const {
		body,
		isStar,
		isSatellite,
		sphereGeometry,
		glowTexture,
		markerTexture,
		selectionTexture,
		selectionColor,
		worldUnitsPerAu,
	} = args
	const colorCss = isStar
		? spectralColor(body.spectralType, body.color)
		: resolveColor(body.color, isSatellite ? '#A09882' : '#CAE1FF')
	const color = new Color(colorCss)
	const radius = physicalBodyRadius(body, isStar, isSatellite, worldUnitsPerAu)
	const extent = physicalBodyExtent(body, isStar, isSatellite, worldUnitsPerAu)

	const anchor = new Group()
	const tiltGroup = new Group()
	const spinGroup = new Group()
	anchor.add(tiltGroup)
	tiltGroup.add(spinGroup)
	// Obliquity is the only stored spin-axis direction. The deterministic map
	// convention tilts the orbital normal toward periapsis.
	const orientation = {
		inclinationDeg: body.inclination ?? 0,
		longitudeAscendingNodeDeg: body.longitudeAscendingNode ?? 0,
		argumentOfPeriapsisDeg: body.argumentOfPeriapsis ?? 0,
	}
	const normalRaw = rotatePerifocalToInertial({ x: 0, y: 0, z: 1 }, orientation)
	const periapsisRaw = rotatePerifocalToInertial({ x: 1, y: 0, z: 0 }, orientation)
	const tilt = (body.axialTilt ?? 0) * Math.PI / 180
	const spinAxis = new Vector3(
		normalRaw.x * Math.cos(tilt) + periapsisRaw.x * Math.sin(tilt),
		normalRaw.y * Math.cos(tilt) + periapsisRaw.y * Math.sin(tilt),
		normalRaw.z * Math.cos(tilt) + periapsisRaw.z * Math.sin(tilt),
	).normalize()
	tiltGroup.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), spinAxis)

	const material = isStar
		? new MeshBasicMaterial({ color })
		: new MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03 })
	const mesh = new Mesh(sphereGeometry, material)
	mesh.scale.setScalar(radius)
	spinGroup.add(mesh)

	let ringGeometry: RingGeometry | null = null
	let ringMaterial: MeshBasicMaterial | null = null
	if (body.hasRings) {
		ringGeometry = new RingGeometry(radius * 1.3, extent, 96)
		ringMaterial = new MeshBasicMaterial({
			color: color.clone().lerp(new Color('#E9C349'), 0.35),
			transparent: true,
			opacity: 0.38,
			side: DoubleSide,
			depthWrite: false,
		})
		tiltGroup.add(new Mesh(ringGeometry, ringMaterial))
	}

	let glowMaterial: SpriteMaterial | null = null
	if (isStar) {
		glowMaterial = new SpriteMaterial({
			map: glowTexture,
			color,
			transparent: true,
			opacity: 0.44,
			depthWrite: false,
			blending: AdditiveBlending,
		})
		const glow = new Sprite(glowMaterial)
		glow.scale.set(radius * 5, radius * 5, 1)
		anchor.add(glow)
	}

	const markerDiameterPx = isStar ? 7 : (isSatellite ? 4 : 5)
	const markerMaterial = new SpriteMaterial({
		map: markerTexture,
		color,
		transparent: true,
		opacity: 0.9,
		depthTest: false,
		depthWrite: false,
	})
	const overviewMarker = new Sprite(markerMaterial)
	overviewMarker.name = 'overview-marker'
	overviewMarker.renderOrder = 8
	anchor.add(overviewMarker)

	const selectionMaterial = new SpriteMaterial({
		map: selectionTexture,
		color: new Color(selectionColor),
		transparent: true,
		opacity: 0,
		depthTest: false,
		depthWrite: false,
	})
	const selectionMarker = new Sprite(selectionMaterial)
	selectionMarker.name = 'selection-marker'
	selectionMarker.scale.setScalar(1)
	selectionMarker.renderOrder = 10
	anchor.add(selectionMarker)
	let screenExtentPx = markerDiameterPx / 2

	return {
		anchor,
		tiltGroup,
		spinGroup,
		mesh,
		radius,
		extent,
		getScreenExtentPx() {
			return screenExtentPx
		},
		setWorldUnitsPerPixel(worldUnitsPerPixel) {
			const safeWorldUnitsPerPixel = Math.max(worldUnitsPerPixel, Number.EPSILON)
			const projectedRadiusPx = extent / safeWorldUnitsPerPixel
			const markerVisible = projectedRadiusPx < markerDiameterPx * 0.7
			markerMaterial.opacity = markerVisible ? 0.9 : 0
			overviewMarker.scale.setScalar(markerDiameterPx * safeWorldUnitsPerPixel)
			const selectionRadius = Math.max(
				extent + safeWorldUnitsPerPixel * 3,
				safeWorldUnitsPerPixel * 8,
			)
			selectionMarker.scale.set(selectionRadius * 2, selectionRadius * 2, 1)
			screenExtentPx = markerVisible ? markerDiameterPx / 2 : projectedRadiusPx
		},
		setSelected(selected, related) {
			// Selection is an annotation, never a mutation of the body's size.
			mesh.scale.setScalar(radius)
			selectionMaterial.opacity = selected ? 0.95 : (related ? 0.18 : 0)
			if (material instanceof MeshStandardMaterial) {
				material.emissive.copy(selected ? color : new Color(0x000000))
				material.emissiveIntensity = selected ? 0.22 : 0
			}
		},
		setDay(day) {
			if (day == null || body.rotationPeriodS == null || body.rotationPeriodS === 0) return
			spinGroup.rotation.z = ((day * 86_400) / body.rotationPeriodS) * Math.PI * 2
		},
		dispose() {
			material.dispose()
			ringGeometry?.dispose()
			ringMaterial?.dispose()
			glowMaterial?.dispose()
			markerMaterial.dispose()
			selectionMaterial.dispose()
		},
	}
}
