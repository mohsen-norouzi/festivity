import * as THREE from 'three'
import type { WireBody } from './wirePhysics'

export interface BurstBody extends WireBody {
  home: THREE.Vector3
  previous: THREE.Vector3
}

export const INFLATE_SECONDS = 1.35
const REPLACE_DELAY = .26

/** Reuse each ornament's body and GPU assets for its matching replacement. */
export function createBurstLifecycle(bodies: readonly BurstBody[], onBurst: (index: number, body: BurstBody) => void, spawn: (index: number, body: BurstBody, generation: number) => void) {
  const states = bodies.map(body => ({
    radius: body.radius, halfSize: body.halfSize.clone(), mass: body.mass,
    phase: 'live' as 'live' | 'gone' | 'arriving', age: 0, charge: 0, scale: 1, previousScale: 1, generation: 0,
  }))
  let held = -1
  let locked = -1
  let pops = 0
  const setTarget = (index: number) => {
    if (index < 0) locked = -1
    held = index === locked || states[index]?.phase !== 'live' ? -1 : index
  }
  const size = (index: number, scale: number) => {
    const state = states[index], body = bodies[index]
    state.scale = scale
    body.radius = state.radius * scale
    body.halfSize.copy(state.halfSize).multiplyScalar(scale)
    // Inflation changes volume, not the amount of material in the ornament.
    body.mass = state.mass
  }
  const step = (dt: number) => {
    states.forEach((state, index) => {
      const body = bodies[index]
      state.previousScale = state.scale
      if (state.phase === 'gone') {
        state.age += dt
        if (state.age >= REPLACE_DELAY) {
          state.phase = 'arriving'; state.age = 0
          size(index, 1); state.previousScale = 1
          spawn(index, body, ++state.generation)
          body.previous.copy(body.position)
          body.velocity.set(0, 0, 0); body.spin.set(0, 0, 0)
          body.enabled = true
        }
        return
      }
      if (state.phase === 'arriving') {
        state.age += dt
        if (state.age > 2.5 && body.position.distanceTo(body.home) < body.radius + .8) state.phase = 'live'
        return
      }
      state.charge = held === index ? Math.min(1, state.charge + dt / INFLATE_SECONDS) : Math.max(0, state.charge - dt * 2.8)
      const ease = state.charge * state.charge * (3 - 2 * state.charge)
      const goal = 1 + ease * (body.isSphere ? 1.7 : .58)
      size(index, THREE.MathUtils.damp(state.scale, goal, 20, dt))
      if (state.charge >= 1) {
        onBurst(index, body)
        pops++
        locked = index; held = -1
        state.phase = 'gone'; state.age = 0; state.charge = 0
        body.enabled = false
        body.velocity.set(0, 0, 0); body.spin.set(0, 0, 0)
      }
    })
  }
  const reset = () => {
    held = locked = -1; pops = 0
    states.forEach((state, index) => {
      state.phase = 'live'; state.age = state.charge = state.generation = 0
      size(index, 1); state.previousScale = 1; bodies[index].enabled = true
    })
  }
  return {
    states, step, setTarget, reset,
    canGrab: (index: number) => index >= 0 && states[index]?.phase === 'live',
    scale: (index: number, alpha = 1) => states[index].radius * THREE.MathUtils.lerp(states[index].previousScale, states[index].scale, alpha),
    get target() { return held }, get pops() { return pops },
  }
}
