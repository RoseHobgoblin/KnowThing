import CameraControls from 'camera-controls'
import {
	Box3,
	Matrix4,
	Quaternion,
	Raycaster,
	Sphere,
	Spherical,
	Vector2,
	Vector3,
	Vector4,
} from 'three'
import type { Object3D, OrthographicCamera, PerspectiveCamera } from 'three'

export type CameraPose = {
	position: Vector3
	target: Vector3
	zoom?: number
	transition?: boolean
	smoothTime?: number
}

export type CameraTransitionOptions = {
	transition?: boolean
	smoothTime?: number
}

export type CameraInputProfile = 'orbit' | 'plan' | 'preview'

export type RodderCameraControlsOptions = {
	domElement?: HTMLElement
	input: CameraInputProfile
	smoothTime: number
	draggingSmoothTime?: number
	dollyToCursor?: boolean
	dollySpeed?: number
	rotateSpeed?: number
}

export type CameraControlsEventHandlers = {
	onControlStart?: () => void
	onControl?: () => void
	onTransitionStart?: () => void
	onUpdate?: () => void
	onRest?: () => void
	onSleep?: () => void
}

type SupportedCamera = PerspectiveCamera | OrthographicCamera

// Install only the Three.js constructors camera-controls uses internally so
// importing the adapter does not force the whole namespace into the bundle.
CameraControls.install({
	THREE: { Box3, Matrix4, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 },
})

/**
 * The camera-controls policy boundary shared by Rodder's Three.js renderers.
 *
 * It owns input profiles, motion tuning, lifecycle subscriptions, and
 * latest-wins programmatic intents. Scene framing and collision geometry stay
 * with each renderer because those depend on renderer-specific world models.
 */
export class RodderCameraControls extends CameraControls {
	readonly defaultSmoothTime: number
	private intentGeneration = 0
	private transitioning = false
	private readonly eventCleanups = new Set<() => void>()
	private readonly handleControlStart = () => this.interrupt()

	constructor(camera: SupportedCamera, options: RodderCameraControlsOptions) {
		super(camera, options.domElement)
		this.defaultSmoothTime = options.smoothTime
		this.smoothTime = options.smoothTime
		this.draggingSmoothTime = options.draggingSmoothTime ?? 0.125
		this.dollyToCursor = options.dollyToCursor ?? true
		if (options.dollySpeed != null) this.dollySpeed = options.dollySpeed
		if (options.rotateSpeed != null) {
			this.azimuthRotateSpeed = options.rotateSpeed
			this.polarRotateSpeed = options.rotateSpeed
		}
		this.setInputProfile(options.input)
		this.addEventListener('controlstart', this.handleControlStart)
	}

	get intentActive(): boolean {
		return this.transitioning
	}

	setInputProfile(profile: CameraInputProfile): void {
		if (profile === 'plan') {
			this.mouseButtons.left = CameraControls.ACTION.TRUCK
			this.mouseButtons.middle = CameraControls.ACTION.ZOOM
			this.mouseButtons.right = CameraControls.ACTION.TRUCK
			this.mouseButtons.wheel = CameraControls.ACTION.ZOOM
			this.touches.one = CameraControls.ACTION.TOUCH_TRUCK
			this.touches.two = CameraControls.ACTION.TOUCH_ZOOM_TRUCK
			return
		}

		this.mouseButtons.left = CameraControls.ACTION.ROTATE
		this.mouseButtons.middle = CameraControls.ACTION.DOLLY
		this.mouseButtons.wheel = CameraControls.ACTION.DOLLY
		this.touches.one = CameraControls.ACTION.TOUCH_ROTATE
		if (profile === 'preview') {
			this.mouseButtons.right = CameraControls.ACTION.NONE
			this.touches.two = CameraControls.ACTION.TOUCH_DOLLY_ROTATE
		} else {
			this.mouseButtons.right = CameraControls.ACTION.TRUCK
			this.touches.two = CameraControls.ACTION.TOUCH_DOLLY_TRUCK
		}
	}

	setBoundaryRadius(radius: number, zRadius = radius): void {
		const safeRadius = Number.isFinite(radius) ? Math.max(Math.abs(radius), Number.EPSILON) : 1
		const safeZRadius = Number.isFinite(zRadius) ? Math.max(Math.abs(zRadius), Number.EPSILON) : safeRadius
		this.setBoundary(new Box3(
			new Vector3(-safeRadius, -safeRadius, -safeZRadius),
			new Vector3(safeRadius, safeRadius, safeZRadius),
		))
	}

	listen(handlers: CameraControlsEventHandlers): () => void {
		if (handlers.onControlStart) this.addEventListener('controlstart', handlers.onControlStart)
		if (handlers.onControl) this.addEventListener('control', handlers.onControl)
		if (handlers.onTransitionStart) this.addEventListener('transitionstart', handlers.onTransitionStart)
		if (handlers.onUpdate) this.addEventListener('update', handlers.onUpdate)
		if (handlers.onRest) this.addEventListener('rest', handlers.onRest)
		if (handlers.onSleep) this.addEventListener('sleep', handlers.onSleep)

		let listening = true
		const cleanup = () => {
			if (!listening) return
			listening = false
			if (handlers.onControlStart) this.removeEventListener('controlstart', handlers.onControlStart)
			if (handlers.onControl) this.removeEventListener('control', handlers.onControl)
			if (handlers.onTransitionStart) this.removeEventListener('transitionstart', handlers.onTransitionStart)
			if (handlers.onUpdate) this.removeEventListener('update', handlers.onUpdate)
			if (handlers.onRest) this.removeEventListener('rest', handlers.onRest)
			if (handlers.onSleep) this.removeEventListener('sleep', handlers.onSleep)
			this.eventCleanups.delete(cleanup)
		}
		this.eventCleanups.add(cleanup)
		return cleanup
	}

	setPose(pose: CameraPose): Promise<boolean> {
		return this.runIntent(pose, () => this.applyPose(pose))
	}

	fitSphere(
		sphereOrObject: Sphere | Object3D,
		options: CameraTransitionOptions = {},
	): Promise<boolean> {
		return this.runIntent(options, () => this.fitToSphere(sphereOrObject, options.transition ?? false))
	}

	frameSphere(
		position: Vector3,
		sphere: Sphere,
		options: CameraTransitionOptions = {},
	): Promise<boolean> {
		const transition = options.transition ?? false
		return this.runIntent(options, () => Promise.all([
			this.setLookAt(
				position.x, position.y, position.z,
				sphere.center.x, sphere.center.y, sphere.center.z,
				transition,
			),
			this.fitToSphere(sphere, transition),
		]))
	}

	interrupt(): void {
		this.intentGeneration++
		if (this.transitioning) {
			void this.applyPose({
				position: this.getPosition(new Vector3(), false),
				target: this.getTarget(new Vector3(), false),
				zoom: this.camera.zoom,
			})
		}
		this.transitioning = false
		this.smoothTime = this.defaultSmoothTime
	}

	override dispose(): void {
		this.intentGeneration++
		this.transitioning = false
		for (const cleanup of this.eventCleanups) cleanup()
		this.removeEventListener('controlstart', this.handleControlStart)
		super.dispose()
	}

	private async applyPose(pose: CameraPose): Promise<void> {
		const transition = pose.transition ?? false
		const { position, target } = pose
		const tasks: Promise<unknown>[] = [
			this.setLookAt(
				position.x, position.y, position.z,
				target.x, target.y, target.z,
				transition,
			),
		]
		if (pose.zoom != null) tasks.push(this.zoomTo(pose.zoom, transition))
		await Promise.all(tasks)
	}

	private async runIntent(
		options: CameraTransitionOptions,
		action: () => Promise<unknown>,
	): Promise<boolean> {
		const generation = ++this.intentGeneration
		const transition = options.transition ?? false
		this.transitioning = transition
		this.smoothTime = options.smoothTime ?? this.defaultSmoothTime
		await action()
		if (generation !== this.intentGeneration) return false
		this.transitioning = false
		this.smoothTime = this.defaultSmoothTime
		return true
	}
}
