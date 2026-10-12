import * as THREE from 'three'
import type { WireBody } from './wirePhysics'

interface History {
  position: THREE.Vector3
  rotation: THREE.Quaternion
  halfSize: THREE.Vector3
  radius: number
  enabled: boolean
  inverse: THREE.Quaternion
  previousInverse: THREE.Quaternion
}

/** Continuous contacts against moving, rotating rounded bodies, including the oil's width. */
export function createLiquidContacts() {
  const history: History[] = []
  let bodies: readonly WireBody[] = []
  const start = new THREE.Vector3(), end = new THREE.Vector3(), travel = new THREE.Vector3()
  const closest = new THREE.Vector3(), axes = new THREE.Vector3(), hitLocal = new THREE.Vector3()
  const hit = { index: -1, time: 1, point: new THREE.Vector3() }

  const prepare = (nextBodies: readonly WireBody[]) => {
    bodies = nextBodies
    bodies.forEach((body, i) => {
      if (!history[i]) {
        history[i] = {
          position: ((body as WireBody & { previous?: THREE.Vector3 }).previous ?? body.position).clone(),
          rotation: body.rotation.clone(), halfSize: body.halfSize.clone(), radius: body.radius, enabled: body.enabled !== false,
          inverse: new THREE.Quaternion(), previousInverse: new THREE.Quaternion(),
        }
      }
      const state = history[i]
      // A replacement enters from outside; it must not sweep across its predecessor's path.
      if (!state.enabled || body.enabled === false) {
        state.position.copy(body.position); state.rotation.copy(body.rotation)
        state.halfSize.copy(body.halfSize); state.radius = body.radius
      }
      state.inverse.copy(body.rotation).invert()
      state.previousInverse.copy(state.rotation).invert()
    })
  }
  const sweep = (from: THREE.Vector3, to: THREE.Vector3, radius: number, ignoreBody = -1, moving = true) => {
    hit.index = -1; hit.time = 1
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i], state = history[i]
      if (body.enabled === false || i === ignoreBody) continue
      start.subVectors(from, moving ? state.position : body.position).applyQuaternion(moving ? state.previousInverse : state.inverse)
      end.subVectors(to, body.position).applyQuaternion(state.inverse)
      travel.subVectors(end, start)
      // Bound the small arc introduced by rotation between physics steps.
      const rotationPad = moving ? body.radius * state.rotation.angleTo(body.rotation) ** 2 * .5 : 0
      const pad = radius + rotationPad
      const reach = Math.max(body.radius, moving ? state.radius : 0) + pad
      const lengthSq = travel.lengthSq()
      closest.copy(start).addScaledVector(travel, lengthSq ? THREE.MathUtils.clamp(-start.dot(travel) / lengthSq, 0, 1) : 0)
      if (closest.lengthSq() > reach * reach) continue
      const power = body.isSphere ? 2 : body.shapePower
      // This envelope includes the round droplet at curved corners, not just its center.
      const corner = Math.max(1, 3 ** (.5 - 1 / power))
      axes.copy(body.halfSize)
      if (moving) axes.max(state.halfSize)
      axes.addScalar(pad * corner)
      start.divide(axes); end.divide(axes); travel.subVectors(end, start)
      const level = (t: number) => Math.abs(start.x + travel.x * t) ** power + Math.abs(start.y + travel.y * t) ** power + Math.abs(start.z + travel.z * t) ** power
      const derivative = (t: number) => {
        const x = start.x + travel.x * t, y = start.y + travel.y * t, z = start.z + travel.z * t
        return Math.sign(x) * Math.abs(x) ** (power - 1) * travel.x + Math.sign(y) * Math.abs(y) ** (power - 1) * travel.y + Math.sign(z) * Math.abs(z) ** (power - 1) * travel.z
      }
      let entry = 0
      if (level(0) > 1) {
        // A convex field has one minimum along the segment. Check the whole sweep,
        // even when both endpoints lie outside a thin or fast-moving cube.
        if (derivative(0) >= 0) continue
        let low = 0, high = 1
        if (derivative(1) > 0) {
          for (let iteration = 0; iteration < 18; iteration++) {
            const mid = (low + high) * .5
            if (derivative(mid) < 0) low = mid
            else high = mid
          }
        }
        const minimum = derivative(1) <= 0 ? 1 : (low + high) * .5
        if (level(minimum) > 1) continue
        low = 0; high = minimum
        for (let iteration = 0; iteration < 18; iteration++) {
          const mid = (low + high) * .5
          if (level(mid) > 1) low = mid
          else high = mid
        }
        entry = high
      }
      if (entry > hit.time) continue
      hit.index = i; hit.time = entry
      hitLocal.copy(start).addScaledVector(travel, entry).multiply(axes)
      hit.point.copy(hitLocal).applyQuaternion(body.rotation).add(body.position)
    }
    return hit.index >= 0 ? hit : undefined
  }
  const commit = () => bodies.forEach((body, i) => {
    const state = history[i]
    state.position.copy(body.position); state.rotation.copy(body.rotation); state.halfSize.copy(body.halfSize)
    state.radius = body.radius; state.enabled = body.enabled !== false
  })
  return { prepare, sweep, commit, reset: () => { history.length = 0 } }
}
