import * as THREE from 'three'
import type { WireBody } from './wirePhysics'

export interface BurstBody extends WireBody {
  home: THREE.Vector3
  previous: THREE.Vector3
}

export const INFLATION_SECONDS = 2.6
const REPLACE_DELAY = .26

/** Reuse each ornament's body and GPU assets for its matching replacement. */
export function createBurstLifecycle(bodies: readonly BurstBody[], onBurst: (index: number, body: BurstBody) => void, spawn: (index: number, body: BurstBody, generation: number) => void, reactionScale: (index: number) => number = () => 1) {
  const states = bodies.map(body => ({
    radius: body.radius, halfSize: body.halfSize.clone(), mass: body.mass,
    phase: 'live' as 'live' | 'inflating' | 'gone' | 'arriving', age: 0, charge: 0, scale: 1, previousScale: 1, generation: 0,
  }))
  let pops = 0
  const start = (index: number) => {
    const state = states[index]
    if (!state || state.phase !== 'live' || bodies[index].enabled === false) return false
    state.phase = 'inflating'
    state.age = state.charge = 0
    return true
  }
  const size = (index: number, scale: number) => {
    const state = states[index], body = bodies[index]
    state.scale = scale
    const physicalScale = scale * reactionScale(index)
    body.radius = state.radius * physicalScale
    body.halfSize.copy(state.halfSize).multiplyScalar(physicalScale)
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
          state.phase = 'arriving'; state.age = state.charge = 0
          size(index, 1); state.previousScale = 1
          spawn(index, body, ++state.generation)
          body.previous.copy(body.position)
          body.velocity.set(0, 0, 0); body.spin.set(0, 0, 0)
          body.enabled = true
        }
        return
      }
      if (state.phase === 'arriving') {
        size(index, 1)
        state.age += dt
        if (state.age > 2.5 && body.position.distanceTo(body.home) < body.radius + .8) state.phase = 'live'
        return
      }
      // One click opens the air valve. Each body owns its countdown, independent
      // of the currently selected song or any later clicks on other ornaments.
      if (state.phase === 'inflating') {
        state.age += dt
        state.charge = Math.min(1, state.age / INFLATION_SECONDS)
      }
      const goal = 1 + state.charge * (body.isSphere ? 1.7 : .58)
      size(index, THREE.MathUtils.damp(state.scale, goal, 18, dt))
      if (state.phase === 'inflating' && state.age >= INFLATION_SECONDS) {
        onBurst(index, body)
        pops++
        state.phase = 'gone'; state.age = 0; state.charge = 0
        body.enabled = false
        body.velocity.set(0, 0, 0); body.spin.set(0, 0, 0)
      }
    })
  }
  const reset = () => {
    pops = 0
    states.forEach((state, index) => {
      state.phase = 'live'; state.age = state.charge = state.generation = 0
      size(index, 1); state.previousScale = 1; bodies[index].enabled = true
    })
  }
  return {
    states, step, start, reset,
    canGrab: (index: number) => bodies[index]?.enabled !== false && (states[index]?.phase === 'live' || states[index]?.phase === 'inflating'),
    scale: (index: number, alpha = 1) => states[index].radius * THREE.MathUtils.lerp(states[index].previousScale, states[index].scale, alpha) * reactionScale(index),
    get pops() { return pops },
  }
}
