import { Vector3 } from 'three'
import type { BurstBody } from './burstLifecycle'

/** A buoyant spring acts on the real body; contacts retain control of its position. */
export function createBalloonFlight() {
  let selected: BurstBody | null = null
  const target = new Vector3(), previousTarget = new Vector3(), targetVelocity = new Vector3(), force = new Vector3()
  return {
    start(body: BurstBody) { selected = body; target.copy(body.position); previousTarget.copy(target); targetVelocity.set(0, 0, 0) },
    aim(point: Vector3, dt: number) {
      target.copy(point)
      targetVelocity.subVectors(target, previousTarget).multiplyScalar(1 / dt).clampLength(0, 16)
      previousTarget.copy(target)
    },
    integrate(body: BurstBody, dt: number) {
      if (body !== selected || body.enabled === false) return false
      // Entrained air gives a large bubble enough inertia to displace its neighbors.
      // The lifecycle restores the original mass before each integration/reset.
      body.mass = Math.max(body.mass, body.radius ** 3 * .45)
      body.previous.copy(body.position)
      force.subVectors(target, body.position).multiplyScalar(36)
        // Critical damping absorbs contact impulses without spring ringing.
        .addScaledVector(targetVelocity, 12).addScaledVector(body.velocity, -12).clampLength(0, 48)
      body.velocity.addScaledVector(force, dt).clampLength(0, 16)
      body.position.addScaledVector(body.velocity, dt)
      return true
    },
    reset() { selected = null },
  }
}
