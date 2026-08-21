import {
	Color,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	RingGeometry,
	Sprite,
	SpriteMaterial,
	Vector3,
	type SphereGeometry,
	type Texture,
} from 'three'
import { rotatePerifocalToInertial } from 'tungolcraft'
import { ASTRONOMICAL_UNIT_M, physicalBodyExtent, physicalBodyRadius } from '../body-sizing.js'
import { resolveColor, spectralColor } from '../colors.js'
import type { VisibilityMode } from '../map-settings.js'
import type { MapBody } from '../root-layout.js'
import { resolveBodyVisibility, type VisibilityBodyKind } from './visibility-controller.js'
import { createPlanetSurfaceVisual, type PlanetSurfaceVisual } from './surface-material.js'
import { createStellarSurfaceVisual, type StellarSurfaceVisual } from './stellar-material.js'
import type { ProceduralTextureSize } from './procedural-texture-client.js'
import { resolveProceduralTextureLod, texturePriorityForLod } from './texture-lod.js'
import { createOverviewMarkerMaterial } from './annotation-material.js'

export type BodyVisual = {
	anchor: Group
	tiltGroup: Group
	spinGroup: Group
	mesh: Mesh
	ringMeshes: Mesh<RingGeometry, MeshStandardMaterial>[]
	radius: number
	extent: number
	ready: Promise<void>
	getProceduralLod(): { desired: ProceduralTextureSize, settled: ProceduralTextureSize | null }
	settleProceduralLod(worldUnitsPerPixel: number): Promise<void>
	getScreenExtentPx(): number
	getPickRadiusPx(): number
	setVisibility(mode: VisibilityMode, worldUnitsPerPixel: number): void
	setSelected(selected: boolean, related: boolean): void
	setDay(day: number | null): void
	dispose(): void
}

export function createBodyVisual(args: {
	body: MapBody
	isStar: boolean
	isSatellite: boolean
	sphereGeometry: SphereGeometry
	markerTexture: Texture
	selectionTexture: Texture
	selectionColor: string
	worldUnitsPerAu: number
	onTextureChange?: () => void
}): BodyVisual {
	const {
		body,
		isStar,
		isSatellite,
		sphereGeometry,
		markerTexture,
		selectionTexture,
		selectionColor,
		worldUnitsPerAu,
		onTextureChange,
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

	let planetSurface: PlanetSurfaceVisual | null = null
	let stellarSurface: StellarSurfaceVisual | null = null
	const material = isStar
		? (stellarSurface = createStellarSurfaceVisual({ body, colorCss, onTextureChange })).material
		: (planetSurface = createPlanetSurfaceVisual({
			body, colorCss, radius, sphereGeometry, onTextureChange,
		})).material
	const mesh = new Mesh(sphereGeometry, material)
	mesh.scale.setScalar(radius)
	spinGroup.add(mesh)
	if (planetSurface?.cloudMesh) spinGroup.add(planetSurface.cloudMesh)
	anchor.userData.surfacePlan = planetSurface?.plan ?? null
	anchor.userData.stellarSurfacePlan = stellarSurface?.plan ?? null

	const ringMeshes: Mesh<RingGeometry, MeshStandardMaterial>[] = []
	const authoredSystems = body.ringSystems ?? []
	for (const system of authoredSystems) {
		for (const [index, band] of system.ringSystem.bands.entries()) {
			const geometry = new RingGeometry(
				band.innerRadiusM / ASTRONOMICAL_UNIT_M * worldUnitsPerAu,
				band.outerRadiusM / ASTRONOMICAL_UNIT_M * worldUnitsPerAu,
				96,
			)
			const material = new MeshStandardMaterial({
				color: new Color(resolveColor(band.color, color.clone().lerp(new Color('#E9C349'), 0.35).getStyle())),
				transparent: (band.opacity ?? 0.38) < 1,
				opacity: band.opacity ?? 0.38,
				side: DoubleSide,
				depthWrite: false,
				roughness: 0.9,
				metalness: 0,
			})
			const ringMesh = new Mesh(geometry, material)
			ringMesh.name = `ring-band:${system.id}:${index}`
			ringMesh.userData = {
				ringSystemId: system.id,
				ringSystemName: system.name,
				bandName: band.name ?? null,
				provenance: band.provenance,
			}
			ringMeshes.push(ringMesh)
			tiltGroup.add(ringMesh)
		}
	}
	anchor.userData.ringPresentation = ringMeshes.length === 0
		? { status: 'unavailable', bandCount: 0 }
		: {
			status: 'authored',
			bandCount: ringMeshes.length,
		}

	const markerMaterial = createOverviewMarkerMaterial(markerTexture, color)
	const overviewMarker = new Sprite(markerMaterial)
	overviewMarker.name = 'overview-marker'
	overviewMarker.renderOrder = 8
	anchor.add(overviewMarker)

	const selectionMaterial = new SpriteMaterial({
		map: selectionTexture,
		color: new Color(selectionColor),
		transparent: true,
		opacity: 0,
		toneMapped: false,
		depthTest: false,
		depthWrite: false,
	})
	const selectionMarker = new Sprite(selectionMaterial)
	selectionMarker.name = 'selection-marker'
	selectionMarker.scale.setScalar(1)
	selectionMarker.renderOrder = 10
	anchor.add(selectionMarker)
	const visibilityKind: VisibilityBodyKind = isStar ? 'star' : (isSatellite ? 'satellite' : 'body')
	let screenExtentPx = 0
	let pickRadiusPx = 8
	let markerActive = false
	const surfaceLod = () => stellarSurface?.getProceduralLod()
		?? planetSurface?.getProceduralLod()
		?? { desired: 256 as const, settled: 256 as const }

	return {
		anchor,
		tiltGroup,
		spinGroup,
		mesh,
		ringMeshes,
		radius,
		extent,
		ready: stellarSurface?.ready ?? planetSurface?.ready ?? Promise.resolve(),
		getProceduralLod: surfaceLod,
		settleProceduralLod(worldUnitsPerPixel) {
			const current = surfaceLod().desired
			const projectedPhysicalDiameterPx = radius * 2 / Math.max(worldUnitsPerPixel, Number.EPSILON)
			const desired = resolveProceduralTextureLod(projectedPhysicalDiameterPx, current)
			return stellarSurface?.setProceduralLod(desired, texturePriorityForLod(desired))
				?? planetSurface?.setProceduralLod(desired, texturePriorityForLod(desired))
				?? Promise.resolve()
		},
		getScreenExtentPx() {
			return screenExtentPx
		},
		getPickRadiusPx() {
			return pickRadiusPx
		},
		setVisibility(mode, worldUnitsPerPixel) {
			const safeWorldUnitsPerPixel = Math.max(worldUnitsPerPixel, Number.EPSILON)
			const projectedRadiusPx = extent / safeWorldUnitsPerPixel
			const visibility = resolveBodyVisibility({
				mode,
				kind: visibilityKind,
				projectedRadiusPx,
				previous: { markerActive },
			})
			markerActive = visibility.markerActive
			stellarSurface?.setVisibilityMode(mode)
			mesh.visible = visibility.meshVisible
			planetSurface?.setGeometryVisible(visibility.meshVisible)
			for (const ringMesh of ringMeshes) ringMesh.visible = visibility.meshVisible
			markerMaterial.opacity = visibility.markerOpacity
			overviewMarker.scale.setScalar(visibility.markerDiameterPx * safeWorldUnitsPerPixel)
			const selectionRadius = Math.max(
				extent + safeWorldUnitsPerPixel * 3,
				safeWorldUnitsPerPixel * 8,
			)
			selectionMarker.scale.set(selectionRadius * 2, selectionRadius * 2, 1)
			screenExtentPx = visibility.screenExtentPx
			pickRadiusPx = visibility.pickRadiusPx
		},
		setSelected(selected, related) {
			// Selection is an annotation, never a mutation of the body's size.
			mesh.scale.setScalar(radius)
			selectionMaterial.opacity = selected ? 0.95 : (related ? 0.18 : 0)
		},
		setDay(day) {
			if (day == null || body.rotationPeriodS == null || body.rotationPeriodS === 0) return
			spinGroup.rotation.z = ((day * 86_400) / body.rotationPeriodS) * Math.PI * 2
		},
		dispose() {
			if (planetSurface) planetSurface.dispose()
			else if (stellarSurface) stellarSurface.dispose()
			else material.dispose()
			for (const ringMesh of ringMeshes) {
				ringMesh.geometry.dispose()
				ringMesh.material.dispose()
			}
			markerMaterial.dispose()
			selectionMaterial.dispose()
		},
	}
}
