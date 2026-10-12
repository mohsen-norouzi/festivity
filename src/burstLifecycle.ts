import * as THREE from 'three'
import type { WireBody } from './wirePhysics'

export interface BurstBody extends WireBody {
  home: THREE.Vector3
  previous: THREE.Vector3
}

export const PUFFS_TO_POP = 5
export const FINAL_PUFF_SECONDS = .18
const REPLACE_DELAY = .26

/** Reuse each ornament's body and GPU assets for its matching replacement. */
export function createBurstLifecycle(bodies: readonly BurstBody[], onBurst: (index: number, body: BurstBody) => void, spawn: (index: number, body: BurstBody, generation: number) => void) {
  const states = bodies.map(body => ({
    radius: body.radius, halfSize: body.halfSize.clone(), mass: body.mass,
    phase: 'live' as 'live' | 'gone' | 'arriving', age: 0, charge: 0, puffs: 0, puffAge: 10, scale: 1, previousScale: 1, generation: 0,
  }))
  let pops = 0
  const puff = (index: number) => {
    const state = states[index]
    if (!state || state.phase !== 'live' || state.puffs >= PUFFS_TO_POP) return false
    state.puffs++
    state.charge = state.puffs / PUFFS_TO_POP
    state.puffAge = 0
    return true
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
      state.puffAge += dt
      if (state.phase === 'gone') {
        state.age += dt
        if (state.age >= REPLACE_DELAY) {
          state.phase = 'arriving'; state.age = 0; state.puffs = 0; state.charge = 0; state.puffAge = 10
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
      // Each discrete click adds air. A soft overshoot makes the puff tangible.
      const pulse = Math.sin(state.puffAge * 24) * Math.exp(-state.puffAge * 10) * .06
      const goal = 1 + state.charge * (body.isSphere ? 1.7 : .58) + pulse
      size(index, THREE.MathUtils.damp(state.scale, goal, 24, dt))
      if (state.puffs === PUFFS_TO_POP && state.puffAge >= FINAL_PUFF_SECONDS) {
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
      state.puffs = 0; state.puffAge = 10
      size(index, 1); state.previousScale = 1; bodies[index].enabled = true
    })
  }
  return {
    states, step, puff, reset,
    canGrab: (index: number) => index >= 0 && states[index]?.phase === 'live' && states[index].puffs < PUFFS_TO_POP,
    scale: (index: number, alpha = 1) => states[index].radius * THREE.MathUtils.lerp(states[index].previousScale, states[index].scale, alpha),
    get pops() { return pops },
  }
}
