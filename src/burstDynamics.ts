import * as THREE from 'three'
import type { WireBody } from './wirePhysics'

export const BURST_SLOTS = 4
export const FRAGMENTS_PER_BURST = 48
export const MOTES_PER_BURST = 30

export interface BurstSource {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Quaternion
  halfSize: THREE.Vector3
  shapePower: number
  radius: number
  baseRadius: number
  finish: string
  color: THREE.Color
  isSphere: boolean
}

const makeParticle = () => ({
  alive: false, age: 0, lifetime: 1, size: .02, drag: 1, roughness: 1, metalness: 0,
  position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(),
  spin: new THREE.Vector3(), proportions: new THREE.Vector3(1, 1, 1), color: new THREE.Color(), mote: false,
})
export type BurstParticle = ReturnType<typeof makeParticle>

/** Exact integration of constant gravity and linear air resistance, independent of frame rate. */
export function integrateDebris(particle: BurstParticle, dt: number, gravity: THREE.Vector3) {
  const decay = Math.exp(-particle.drag * dt)
  const travel = (1 - decay) / particle.drag
  const fall = (dt - travel) / particle.drag
  particle.position.addScaledVector(particle.velocity, travel).addScaledVector(gravity, fall)
  particle.velocity.multiplyScalar(decay).addScaledVector(gravity, travel)
}

export function createBurstDynamics(random: () => number = Math.random) {
  const slots = Array.from({ length: BURST_SLOTS }, () => ({
    finish: '', particles: Array.from({ length: FRAGMENTS_PER_BURST + MOTES_PER_BURST }, makeParticle),
  }))
  const direction = new THREE.Vector3(), normal = new THREE.Vector3(), delta = new THREE.Vector3(), local = new THREE.Vector3()
  const surfaceVelocity = new THREE.Vector3(), lever = new THREE.Vector3(), spinStep = new THREE.Quaternion()
  const vents = Array.from({ length: 3 }, () => new THREE.Vector3())
  const hsl = { h: 0, s: 0, l: 0 }
  const bodyInverses: THREE.Quaternion[] = []
  let nextSlot = 0

  const randomDirection = (target: THREE.Vector3) => {
    const z = random() * 2 - 1, angle = random() * Math.PI * 2, r = Math.sqrt(1 - z * z)
    return target.set(r * Math.cos(angle), r * Math.sin(angle), z)
  }

  const burst = (source: BurstSource) => {
    const slot = slots[nextSlot++ % BURST_SLOTS]
    slot.finish = source.finish
    const fragments = source.isSphere ? Math.round(12 + source.baseRadius * 35) : Math.min(FRAGMENTS_PER_BURST, Math.round(20 + source.baseRadius * 22))
    const motes = source.isSphere ? 12 : 24
    vents.forEach(vent => randomDirection(vent))
    source.color.getHSL(hsl, THREE.SRGBColorSpace)
    const energy = Math.sqrt(source.baseRadius) * (source.isSphere ? 4.6 : 5.5)
    slot.particles.forEach((particle, index) => {
      particle.mote = index >= FRAGMENTS_PER_BURST
      particle.alive = particle.mote ? index - FRAGMENTS_PER_BURST < motes : index < fragments
      if (!particle.alive) return
      particle.age = 0
      // Many fine fragments and a few larger pieces, with a different distribution each time.
      const weight = random() ** 2.4
      particle.size = source.radius * (particle.mote ? .007 + random() * .012 : .018 + weight * .12)
      particle.lifetime = particle.mote ? .65 + random() * .55 : 1.25 + random() * .85 + weight * .2
      particle.drag = particle.mote ? 3.5 + random() * 3 : (source.isSphere ? 1.6 : .4) + (1 - weight) * 1.25
      particle.proportions.set(.65 + random() * .75, .65 + random() * .9, .6 + random() * .8)
      particle.roughness = .55 + random() ** .8 * 1.65
      particle.metalness = source.isSphere || source.finish === 'glass' ? 0 : (random() - .5) * .16
      const light = (random() - .5) * (source.finish === 'ink' ? .075 : .19)
      particle.color.setHSL((hsl.h + (random() - .5) * .06 + 1) % 1, THREE.MathUtils.clamp(hsl.s + (random() - .5) * .16, 0, 1), THREE.MathUtils.clamp(hsl.l + light, .025, .97), THREE.SRGBColorSpace)
      // Irregular rupture sites across the original surface, biased toward three random vents.
      randomDirection(direction).multiplyScalar(.8).addScaledVector(vents[Math.floor(random() * vents.length)], .65).normalize()
      const p = source.shapePower
      const surface = (Math.abs(direction.x) ** p + Math.abs(direction.y) ** p + Math.abs(direction.z) ** p) ** (-1 / p)
      local.copy(direction).multiply(source.halfSize).multiplyScalar(surface * (.5 + random() * .48))
      particle.position.copy(local).applyQuaternion(source.rotation).add(source.position)
      const speed = energy * (.35 + random() * 1.1) / (.8 + weight * .8)
      particle.velocity.copy(direction).applyQuaternion(source.rotation).multiplyScalar(speed).addScaledVector(source.velocity, .65)
      particle.velocity.y += energy * (random() - .3) * .18
      randomDirection(normal)
      particle.rotation.setFromAxisAngle(normal, random() * Math.PI * 2)
      randomDirection(particle.spin).multiplyScalar((random() - .5) * 13)
    })
    return slot
  }

  const collide = (particle: BurstParticle, bodies: readonly WireBody[]) => {
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i]
      if (body.enabled === false) continue
      delta.subVectors(particle.position, body.position)
      const padding = particle.size * 1.25
      if (delta.lengthSq() > (body.radius + padding) ** 2) continue
      let depth: number
      if (body.isSphere) {
        const distance = delta.length()
        depth = body.radius + padding - distance
        if (depth <= 0) continue
        normal.copy(delta).multiplyScalar(1 / Math.max(distance, .0001))
      } else {
        local.copy(delta).applyQuaternion(bodyInverses[i])
        const { x: ax, y: ay, z: az } = body.halfSize
        if (Math.abs(local.x) > ax + padding || Math.abs(local.y) > ay + padding || Math.abs(local.z) > az + padding) continue
        const p = body.shapePower, x = Math.abs(local.x) / ax, y = Math.abs(local.y) / ay, z = Math.abs(local.z) / az
        const level = (x ** p + y ** p + z ** p) ** (1 / p)
        if (level < .00001) continue
        normal.set(Math.sign(local.x) * x ** (p - 1) / ax, Math.sign(local.y) * y ** (p - 1) / ay, Math.sign(local.z) * z ** (p - 1) / az).multiplyScalar(level ** (1 - p))
        const gradient = normal.length()
        depth = padding - (level - 1) / gradient
        if (depth <= 0) continue
        normal.multiplyScalar(1 / gradient).applyQuaternion(body.rotation)
      }
      particle.position.addScaledVector(normal, depth + .002)
      lever.subVectors(particle.position, body.position)
      surfaceVelocity.crossVectors(body.spin, lever).add(body.velocity)
      delta.subVectors(particle.velocity, surfaceVelocity)
      const incoming = delta.dot(normal)
      if (incoming < 0) {
        delta.addScaledVector(normal, -incoming * 1.28).multiplyScalar(.82)
        particle.velocity.copy(surfaceVelocity).add(delta)
        particle.spin.multiplyScalar(.65)
      }
    }
  }

  const step = (dt: number, gravity: THREE.Vector3, bodies: readonly WireBody[] = []) => {
    bodies.forEach((body, i) => {
      if (!bodyInverses[i]) bodyInverses[i] = new THREE.Quaternion()
      bodyInverses[i].copy(body.rotation).invert()
    })
    const steps = Math.max(1, Math.ceil(dt * 120)), substep = dt / steps
    for (const slot of slots) for (const particle of slot.particles) {
      if (!particle.alive) continue
      particle.age += dt
      if (particle.age >= particle.lifetime) { particle.alive = false; continue }
      for (let i = 0; i < steps; i++) {
        integrateDebris(particle, substep, gravity)
        if (!particle.mote && particle.age > .045) collide(particle, bodies)
      }
      const speed = particle.spin.length()
      if (speed > .0001) {
        normal.copy(particle.spin).multiplyScalar(1 / speed)
        spinStep.setFromAxisAngle(normal, speed * dt)
        particle.rotation.premultiply(spinStep).normalize()
      }
    }
  }
  const reset = () => { nextSlot = 0; slots.forEach(slot => slot.particles.forEach(particle => { particle.alive = false })) }
  return { slots, burst, step, reset, get active() { return slots.some(slot => slot.particles.some(particle => particle.alive)) } }
}
