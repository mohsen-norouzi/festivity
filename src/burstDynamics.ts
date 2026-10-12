import * as THREE from 'three'
import type { WireBody } from './wirePhysics'
import { createLiquidContacts } from './liquidCollision'

export const BURST_SLOTS = 4
export const FRAGMENTS_PER_BURST = 24
export const MOTES_PER_BURST = 8
export const SURFACE_DROPS = 64

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
  position: new THREE.Vector3(), previous: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(),
  proportions: new THREE.Vector3(1, 1, 1), color: new THREE.Color(), mote: false, finish: '',
  phase: 0, ignoreBody: -1, link: -1, neck: 0, restLength: 0, separationAge: 1,
})
export type BurstParticle = ReturnType<typeof makeParticle>
const makeSurfaceDrop = () => ({
  alive: false, bodyIndex: -1, age: 0, size: .02, finish: '', roughness: 1,
  // Unit coordinates follow the host's inflation as well as its rigid motion.
  anchor: new THREE.Vector3(), flow: new THREE.Vector3(), color: new THREE.Color(),
  position: new THREE.Vector3(), normal: new THREE.Vector3(), impact: 0, aspect: 1, phase: 0,
})
export type SurfaceDrop = ReturnType<typeof makeSurfaceDrop>

/** Exact gravity and linear air resistance, independent of rendering frame rate. */
export function integrateDebris(particle: BurstParticle, dt: number, gravity: THREE.Vector3) {
  const decay = Math.exp(-particle.drag * dt)
  const travel = (1 - decay) / particle.drag
  const fall = (dt - travel) / particle.drag
  particle.position.addScaledVector(particle.velocity, travel).addScaledVector(gravity, fall)
  particle.velocity.multiplyScalar(decay).addScaledVector(gravity, travel)
}

/** Lightweight surface tension: airborne drops deposit, merge, creep, and drip. */
export function createBurstDynamics(random: () => number = Math.random) {
  const slots = Array.from({ length: BURST_SLOTS }, () => ({
    finish: '', particles: Array.from({ length: FRAGMENTS_PER_BURST + MOTES_PER_BURST }, makeParticle),
  }))
  const contacts = createLiquidContacts()
  const sweepStart = new THREE.Vector3()
  const deposits = Array.from({ length: SURFACE_DROPS }, makeSurfaceDrop)
  const direction = new THREE.Vector3(), normal = new THREE.Vector3(), delta = new THREE.Vector3(), local = new THREE.Vector3()
  const surfaceVelocity = new THREE.Vector3(), lever = new THREE.Vector3(), tangent = new THREE.Vector3(), gravityLocal = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0), newRotation = new THREE.Quaternion()
  const vents = Array.from({ length: 3 }, () => new THREE.Vector3())
  const hsl = { h: 0, s: 0, l: 0 }
  const bodyInverses: THREE.Quaternion[] = []
  let nextSlot = 0, nextDeposit = 0

  const randomDirection = (target: THREE.Vector3) => {
    const z = random() * 2 - 1, angle = random() * Math.PI * 2, r = Math.sqrt(1 - z * z)
    return target.set(r * Math.cos(angle), r * Math.sin(angle), z)
  }
  const project = (point: THREE.Vector3, body: WireBody) => {
    const p = body.isSphere ? 2 : body.shapePower
    const level = (Math.abs(point.x / body.halfSize.x) ** p + Math.abs(point.y / body.halfSize.y) ** p + Math.abs(point.z / body.halfSize.z) ** p) ** (1 / p)
    if (level < 1e-8) point.set(0, body.halfSize.y, 0)
    else point.multiplyScalar(1 / level)
    normal.set(
      Math.sign(point.x) * Math.abs(point.x / body.halfSize.x) ** (p - 1) / body.halfSize.x,
      Math.sign(point.y) * Math.abs(point.y / body.halfSize.y) ** (p - 1) / body.halfSize.y,
      Math.sign(point.z) * Math.abs(point.z / body.halfSize.z) ** (p - 1) / body.halfSize.z,
    ).normalize()
  }
  const syncDeposit = (drop: SurfaceDrop, body: WireBody) => {
    local.copy(drop.anchor).multiply(body.halfSize)
    project(local, body)
    drop.anchor.copy(local).divide(body.halfSize)
    drop.position.copy(local).applyQuaternion(body.rotation).add(body.position)
    drop.normal.copy(normal).applyQuaternion(body.rotation)
  }

  const burst = (source: BurstSource) => {
    const slot = slots[nextSlot++ % BURST_SLOTS]
    slot.finish = source.finish
    const fragments = source.isSphere ? Math.round(5 + source.baseRadius * 14) : Math.min(FRAGMENTS_PER_BURST, Math.round(10 + source.baseRadius * 8))
    const motes = source.isSphere ? 3 : 6
    vents.forEach(vent => randomDirection(vent))
    source.color.getHSL(hsl, THREE.SRGBColorSpace)
    const energy = Math.sqrt(source.baseRadius) * (source.isSphere ? 3.8 : 4.4)
    slot.particles.forEach((particle, index) => {
      particle.mote = index >= FRAGMENTS_PER_BURST
      particle.alive = particle.mote ? index - FRAGMENTS_PER_BURST < motes : index < fragments
      if (!particle.alive) return
      particle.age = 0; particle.finish = source.finish; particle.ignoreBody = -1
      particle.link = -1; particle.neck = 0
      const weight = random() ** 2.4
      particle.size = source.radius * (particle.mote ? .005 + random() * .01 : .019 + weight * .135)
      particle.lifetime = particle.mote ? .55 + random() * .45 : 2.4 + random() * .8
      particle.drag = particle.mote ? 4 + random() * 3 : .65 + (1 - weight) * .95
      particle.roughness = .65 + random() * .85
      particle.metalness = 0
      particle.phase = random() * Math.PI * 2
      particle.proportions.set(1, 1, 1)
      const light = (random() - .5) * (source.finish === 'ink' ? .055 : .14)
      particle.color.setHSL((hsl.h + (random() - .5) * .045 + 1) % 1, THREE.MathUtils.clamp(hsl.s + (random() - .5) * .12, 0, 1), THREE.MathUtils.clamp(hsl.l + light, .025, .97), THREE.SRGBColorSpace)
      randomDirection(direction).multiplyScalar(.8).addScaledVector(vents[Math.floor(random() * vents.length)], .65).normalize()
      const p = source.shapePower
      const surface = (Math.abs(direction.x) ** p + Math.abs(direction.y) ** p + Math.abs(direction.z) ** p) ** (-1 / p)
      local.copy(direction).multiply(source.halfSize).multiplyScalar(surface * (.5 + random() * .48))
      particle.position.copy(local).applyQuaternion(source.rotation).add(source.position)
      const speed = energy * (.35 + random() * 1.1) / (.8 + weight * .8)
      particle.velocity.copy(direction).applyQuaternion(source.rotation).multiplyScalar(speed).addScaledVector(source.velocity, .65)
      particle.velocity.y += energy * (random() - .3) * .18
      particle.rotation.setFromUnitVectors(up, direction.copy(particle.velocity).normalize())
    })
    // The rupture starts as connected liquid lobes, then draws out into necks.
    // One third of the drops remain fine spray; the rest form viscous pairs.
    for (let i = 1; i < fragments; i += 2) {
      if (i % 6 === 5) continue
      const trailing = slot.particles[i], leading = slot.particles[i - 1]
      leading.size = Math.max(leading.size, source.radius * .07)
      trailing.link = i - 1; trailing.neck = .9
      trailing.restLength = (leading.size + trailing.size) * .8
      trailing.separationAge = .7 + random() * .55
      direction.copy(leading.velocity).normalize()
      trailing.position.copy(leading.position).addScaledVector(direction, -trailing.restLength)
      trailing.velocity.copy(leading.velocity).multiplyScalar(.38 + random() * .18)
      trailing.rotation.copy(leading.rotation)
    }
    slot.particles.forEach(particle => particle.previous.copy(particle.position))
    return slot
  }

  const deposit = (particle: BurstParticle, body: WireBody, index: number, impact: number) => {
    local.subVectors(particle.position, body.position).applyQuaternion(bodyInverses[index])
    project(local, body)
    // Neighboring beads of the same liquid merge instead of stacking rigid pieces.
    let drop = deposits.find(other => other.alive && other.bodyIndex === index && other.finish === particle.finish &&
      delta.copy(other.anchor).multiply(body.halfSize).distanceTo(local) < (other.size + particle.size) * 1.15)
    if (drop) {
      const previousVolume = drop.size ** 3, addedVolume = particle.size ** 3
      drop.color.lerp(particle.color, addedVolume / (previousVolume + addedVolume))
      drop.size = Math.min(Math.cbrt(previousVolume + addedVolume), body.radius * .16)
      drop.impact = Math.min(1, impact / 6); drop.age = 0
    } else {
      drop = deposits.find(other => !other.alive) ?? deposits[nextDeposit++ % SURFACE_DROPS]
      drop.alive = true; drop.bodyIndex = index; drop.age = 0
      drop.finish = particle.finish; drop.size = Math.min(particle.size, body.radius * .14)
      drop.roughness = particle.roughness; drop.color.copy(particle.color)
      drop.anchor.copy(local).divide(body.halfSize); drop.flow.set(0, 0, 0)
      drop.impact = Math.min(1, impact / 6); drop.aspect = .82 + random() * .36; drop.phase = random() * Math.PI * 2
    }
    syncDeposit(drop, body)
    particle.alive = false
    particle.link = -1; particle.neck = 0
  }

  const collide = (particle: BurstParticle, from: THREE.Vector3, bodies: readonly WireBody[]) => {
    // Include the full stretched, wobbling lobe seen in the vertex shader.
    const padding = particle.mote ? particle.size : particle.size * 2.15
    let ignoreBody = -1
    const releasing = bodies[particle.ignoreBody]
    if (releasing && releasing.enabled !== false) {
      local.subVectors(particle.position, releasing.position).applyQuaternion(bodyInverses[particle.ignoreBody])
      project(local, releasing)
      normal.applyQuaternion(releasing.rotation)
      lever.subVectors(particle.position, releasing.position)
      surfaceVelocity.crossVectors(releasing.spin, lever).add(releasing.velocity)
      delta.subVectors(particle.velocity, surfaceVelocity)
      // Let a drip finish pulling out of its own wet film while it is moving outward.
      // A host moving back into it still makes contact immediately.
      if (delta.dot(normal) > 0 && lever.length() < releasing.radius + padding) ignoreBody = particle.ignoreBody
      else particle.ignoreBody = -1
    }
    const hit = contacts.sweep(from, particle.position, padding, ignoreBody)
    if (!hit) return
    if (particle.mote) { particle.alive = false; return }
    particle.position.copy(hit.point)
    const body = bodies[hit.index]
    surfaceVelocity.subVectors(particle.velocity, body.velocity)
    deposit(particle, body, hit.index, surfaceVelocity.length())
  }

  const drip = (drop: SurfaceDrop, body: WireBody) => {
    let particle: BurstParticle | undefined
    for (const slot of slots) {
      particle = slot.particles.find((candidate, index) => index < FRAGMENTS_PER_BURST && !candidate.alive)
      if (particle) break
    }
    if (!particle) return
    particle.alive = true; particle.mote = false; particle.age = 0; particle.lifetime = 3.2
    particle.finish = drop.finish; particle.size = drop.size * .88; particle.drag = 1.3
    particle.color.copy(drop.color); particle.roughness = drop.roughness; particle.metalness = 0
    particle.ignoreBody = drop.bodyIndex; particle.phase = random() * Math.PI * 2
    particle.link = -1; particle.neck = 0
    particle.position.copy(drop.position).addScaledVector(drop.normal, particle.size * 1.1)
    lever.subVectors(particle.position, body.position)
    particle.velocity.crossVectors(body.spin, lever).add(body.velocity).addScaledVector(drop.normal, .25)
    particle.previous.copy(particle.position)
    particle.proportions.set(1, 1, 1); particle.rotation.identity()
    drop.alive = false
  }

  const step = (dt: number, gravity: THREE.Vector3, bodies: readonly WireBody[] = []) => {
    contacts.prepare(bodies)
    bodies.forEach((body, i) => {
      if (!bodyInverses[i]) bodyInverses[i] = new THREE.Quaternion()
      bodyInverses[i].copy(body.rotation).invert()
    })
    for (const drop of deposits) {
      if (!drop.alive) continue
      const body = bodies[drop.bodyIndex]
      // A replacement is a new dry object; liquid must not teleport to it.
      if (!body || body.enabled === false) { drop.alive = false; continue }
      drop.age += dt
      syncDeposit(drop, body)
      gravityLocal.copy(gravity).applyQuaternion(bodyInverses[drop.bodyIndex])
      tangent.copy(gravityLocal).addScaledVector(normal, -gravityLocal.dot(normal))
      // Surface tension pins small beads. Larger ones slowly drain downhill.
      const mobility = Math.max(0, drop.size - .045) * .8
      drop.flow.addScaledVector(tangent, mobility * dt).multiplyScalar(Math.exp(-3.2 * dt))
      local.addScaledVector(drop.flow, dt)
      project(local, body)
      drop.anchor.copy(local).divide(body.halfSize)
      syncDeposit(drop, body)
      if (drop.age > 1.1 && drop.size > .075 && drop.normal.dot(gravity) > gravity.length() * .72) drip(drop, body)
    }
    for (const slot of slots) for (const particle of slot.particles) {
      if (!particle.alive || particle.link < 0) continue
      const partner = slot.particles[particle.link]
      if (!partner.alive) { particle.link = -1; particle.neck = 0; continue }
      delta.subVectors(partner.position, particle.position)
      const distance = delta.length(), size = particle.size + partner.size
      const time = 1 - THREE.MathUtils.smoothstep(particle.age / particle.separationAge, .24, 1)
      particle.neck = .9 * time ** .75 * (1 - THREE.MathUtils.smoothstep(distance / size, 3, 7))
      if (particle.neck < .012) { particle.link = -1; particle.neck = 0; continue }
      // Surface tension and viscous drag exchange momentum between the two lobes.
      const firstMass = particle.size ** 3, secondMass = partner.size ** 3
      surfaceVelocity.subVectors(partner.velocity, particle.velocity).multiplyScalar(1.6)
      if (distance > .0001) surfaceVelocity.addScaledVector(delta, (distance - particle.restLength) * 5 / distance)
      surfaceVelocity.multiplyScalar(dt * particle.neck)
      particle.velocity.addScaledVector(surfaceVelocity, secondMass / (firstMass + secondMass))
      partner.velocity.addScaledVector(surfaceVelocity, -firstMass / (firstMass + secondMass))
    }
    for (const slot of slots) for (const particle of slot.particles) {
      if (!particle.alive) continue
      particle.previous.copy(particle.position)
      particle.age += dt
      if (particle.age >= particle.lifetime) { particle.alive = false; continue }
      sweepStart.copy(particle.position)
      integrateDebris(particle, dt, gravity)
      collide(particle, sweepStart, bodies)
      // Surface-tension oscillation conserves volume; motion stretches the drop.
      const speed = particle.velocity.length()
      const stretch = 1 + Math.min(.7, speed * .085) + Math.sin(particle.age * 10 + particle.phase) * .24 * Math.exp(-particle.age * .65)
      particle.proportions.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch))
      if (speed > .001) particle.rotation.slerp(newRotation.setFromUnitVectors(up, direction.copy(particle.velocity).multiplyScalar(1 / speed)), 1 - Math.exp(-18 * dt))
    }
    // Check the entire curved, thick connection after both endpoints have moved.
    for (const slot of slots) for (const particle of slot.particles) {
      if (!particle.alive || particle.link < 0) continue
      const partner = slot.particles[particle.link]
      if (!partner.alive) { particle.link = -1; particle.neck = 0; continue }
      const bow = Math.min(.022, particle.age * particle.age * .028) * gravity.length()
      const width = Math.min(particle.size, partner.size) * particle.neck * 2.1 + bow
      const hit = contacts.sweep(partner.position, particle.position, width, -1, false)
      if (hit) {
        particle.position.copy(hit.point)
        const body = bodies[hit.index]
        deposit(particle, body, hit.index, particle.velocity.distanceTo(body.velocity))
        particle.link = -1; particle.neck = 0
      }
    }
    contacts.commit()
  }

  const reset = () => {
    nextSlot = nextDeposit = 0
    contacts.reset()
    slots.forEach(slot => slot.particles.forEach(particle => { particle.alive = false }))
    deposits.forEach(drop => { drop.alive = false })
  }
  return {
    slots, deposits, burst, step, reset,
    get active() { return deposits.some(drop => drop.alive) || slots.some(slot => slot.particles.some(particle => particle.alive)) },
    get surfaceCount() { return deposits.reduce((count, drop) => count + Number(drop.alive), 0) },
  }
}
