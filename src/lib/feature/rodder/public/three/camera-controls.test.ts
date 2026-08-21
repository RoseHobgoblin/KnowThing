import { afterAll, describe, expect, it, vi } from 'vitest'
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'
import { RodderCameraControls } from './camera-controls.js'

vi.stubGlobal('DOMRect', class DOMRect {
	bottom: number
	left: number
	right: number
	top: number

	constructor(
		public x = 0,
		public y = 0,
		public width = 0,
		public height = 0,
	) {
		this.bottom = y + height
		this.left = x
		this.right = x + width
		this.top = y
	}

	toJSON() {
		return { x: this.x, y: this.y, width: this.width, height: this.height }
	}
})

afterAll(() => vi.unstubAllGlobals())

describe('rodder camera-controls adapter', () => {
	it('keeps Z-up look-at state when switching between projection cameras', async () => {
		const perspective = new PerspectiveCamera(50, 16 / 9, 0.01, 10_000)
		perspective.up.set(0, 0, 1)
		const controls = new RodderCameraControls(perspective, { input: 'orbit', smoothTime: 0.1 })

		await controls.setLookAt(8, -6, 5, 1, 2, 3, false)
		controls.update(0)
		expect(perspective.position.distanceTo(new Vector3(8, -6, 5))).toBeLessThan(1e-12)
		expect(controls.getTarget(new Vector3(), false).toArray()).toEqual([1, 2, 3])

		const orthographic = new OrthographicCamera(-10, 10, 10, -10, 0.1, 10_000)
		orthographic.up.set(0, 0, 1)
		controls.camera = orthographic
		await controls.setPose({
			position: new Vector3(4, -3, 20),
			target: new Vector3(-2, 5, 0),
			zoom: 12,
		})
		controls.update(0)

		expect(orthographic.position.distanceTo(new Vector3(4, -3, 20))).toBeLessThan(1e-12)
		expect(orthographic.zoom).toBe(12)
		expect(controls.getTarget(new Vector3(), false).toArray()).toEqual([-2, 5, 0])
		controls.dispose()
	})

	it('creates a finite target boundary from renderer scale', () => {
		const camera = new PerspectiveCamera(50, 1, 0.01, 10_000)
		const controls = new RodderCameraControls(camera, { input: 'orbit', smoothTime: 0.1 })
		controls.setBoundaryRadius(12, 3)
		void controls.moveTo(20, -20, 8, false)
		controls.update(0)
		expect(controls.getTarget(new Vector3(), false).toArray()).toEqual([12, -12, 3])
		controls.dispose()
	})

	it('applies explicit orbit, plan, and preview input profiles', () => {
		const controls = new RodderCameraControls(new PerspectiveCamera(50, 1, 0.01, 10_000), {
			input: 'orbit',
			smoothTime: 0.4,
			dollySpeed: 1.8,
		})
		expect(controls.smoothTime).toBe(0.4)
		expect(controls.dollySpeed).toBe(1.8)
		expect(controls.mouseButtons.left).toBe(RodderCameraControls.ACTION.ROTATE)
		expect(controls.mouseButtons.right).toBe(RodderCameraControls.ACTION.TRUCK)

		controls.setInputProfile('plan')
		expect(controls.mouseButtons.left).toBe(RodderCameraControls.ACTION.TRUCK)
		expect(controls.mouseButtons.wheel).toBe(RodderCameraControls.ACTION.ZOOM)
		expect(controls.touches.two).toBe(RodderCameraControls.ACTION.TOUCH_ZOOM_TRUCK)

		controls.setInputProfile('preview')
		expect(controls.mouseButtons.right).toBe(RodderCameraControls.ACTION.NONE)
		expect(controls.touches.two).toBe(RodderCameraControls.ACTION.TOUCH_DOLLY_ROTATE)
		controls.dispose()
	})

	it('cleans up bound lifecycle event handlers as a unit', () => {
		const controls = new RodderCameraControls(
			new PerspectiveCamera(50, 1, 0.01, 10_000),
			{ input: 'orbit', smoothTime: 0.1 },
		)
		const onUpdate = vi.fn()
		const onRest = vi.fn()
		const unbind = controls.listen({ onUpdate, onRest })

		controls.dispatchEvent({ type: 'update' })
		controls.dispatchEvent({ type: 'rest' })
		expect(onUpdate).toHaveBeenCalledOnce()
		expect(onRest).toHaveBeenCalledOnce()

		unbind()
		controls.dispatchEvent({ type: 'update' })
		controls.dispatchEvent({ type: 'rest' })
		expect(onUpdate).toHaveBeenCalledOnce()
		expect(onRest).toHaveBeenCalledOnce()
		controls.dispose()
	})

	it('emits rest once a smooth look-at transition settles', () => {
		const camera = new PerspectiveCamera(50, 1, 0.01, 10_000)
		camera.up.set(0, 0, 1)
		const controls = new RodderCameraControls(camera, { input: 'orbit', smoothTime: 0.1 })
		const onRest = vi.fn()
		const onSleep = vi.fn()
		controls.addEventListener('rest', onRest)
		controls.addEventListener('sleep', onSleep)

		void controls.setLookAt(10, -8, 6, 1, 2, 0, true)
		for (let frame = 0; frame < 180; frame++) controls.update(1 / 60)

		expect(onRest).toHaveBeenCalledTimes(1)
		expect(onSleep).toHaveBeenCalledTimes(1)
		expect(controls.getTarget(new Vector3(), false).toArray()).toEqual([1, 2, 0])
		controls.dispose()
	})

	it('only accepts completion from the latest programmatic intent', async () => {
		const camera = new PerspectiveCamera(50, 1, 0.01, 10_000)
		camera.up.set(0, 0, 1)
		const controls = new RodderCameraControls(camera, { input: 'orbit', smoothTime: 0.1 })
		const first = controls.setPose({
			position: new Vector3(8, -6, 5),
			target: new Vector3(1, 0, 0),
			transition: true,
		})
		const second = controls.setPose({
			position: new Vector3(4, -3, 2),
			target: new Vector3(0, 2, 0),
			transition: true,
		})

		for (let frame = 0; frame < 180; frame++) controls.update(1 / 60)

		expect(await first).toBe(false)
		expect(await second).toBe(true)
		expect(controls.intentActive).toBe(false)
		expect(controls.getTarget(new Vector3(), false).distanceTo(new Vector3(0, 2, 0))).toBeLessThan(1e-12)
		controls.dispose()
	})

	it('holds the current camera pose when user control interrupts an intent', async () => {
		const camera = new PerspectiveCamera(50, 1, 0.01, 10_000)
		camera.up.set(0, 0, 1)
		const controls = new RodderCameraControls(camera, { input: 'orbit', smoothTime: 0.2 })
		const transition = controls.setPose({
			position: new Vector3(10, -8, 6),
			target: new Vector3(1, 2, 0),
			transition: true,
		})

		for (let frame = 0; frame < 5; frame++) controls.update(1 / 60)
		const interruptedPosition = controls.getPosition(new Vector3(), false)
		const interruptedTarget = controls.getTarget(new Vector3(), false)
		controls.dispatchEvent({ type: 'controlstart' })
		for (let frame = 0; frame < 60; frame++) controls.update(1 / 60)

		expect(await transition).toBe(false)
		expect(controls.intentActive).toBe(false)
		expect(controls.getPosition(new Vector3(), false).distanceTo(interruptedPosition)).toBeLessThan(1e-12)
		expect(controls.getTarget(new Vector3(), false).distanceTo(interruptedTarget)).toBeLessThan(1e-12)
		controls.dispose()
	})
})
