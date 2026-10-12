import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createBurstDynamics, integrateDebris, SURFACE_DROPS, type BurstSource } from '../src/burstDynamics'
import { createBurstEffects } from '../src/burstEffects'
import { burstSoundProfile } from '../src/burstSoundProfile'
import type { WireBody } from '../src/wirePhysics'

const random = () => {
  let seed = 3791
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}
const source = (finish = 'coral'): BurstSource => ({
  position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), halfSize: new THREE.Vector3(1, 1, .85),
  shapePower: 3.8, radius: 1.55, baseRadius: 1, finish, color: new THREE.Color('#f18f86'), isSphere: false,
})

const cube = (): WireBody => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.6, .6, .6), radius: 1, mass: 1, shapePower: 3.8 })
const gravity = new THREE.Vector3(0, -7.8, 0)

describe('liquid bursts and surface tension', () => {
  test('gravity curves trajectories downward and is independent of frame rate', () => {
    const a = createBurstDynamics(random()).slots[0].particles[0], b = createBurstDynamics(random()).slots[0].particles[0]
    a.drag = b.drag = 1.2
    a.velocity.set(3, 2, .5); b.velocity.copy(a.velocity)
    const gravity = new THREE.Vector3(0, -7.8, 0)
    integrateDebris(a, 1, gravity)
    for (let i = 0; i < 120; i++) integrateDebris(b, 1 / 120, gravity)
    expect(a.position.distanceTo(b.position)).toBeLessThan(1e-10)
    expect(a.velocity.distanceTo(b.velocity)).toBeLessThan(1e-10)
    expect(a.position.y).toBeLessThan(-1)
    expect(a.velocity.y).toBeLessThan(-3)
    expect(a.position.x).toBeLessThan(3)
  })

  test('fragment size, finish, launch speed, and color vary while retaining the source palette', () => {
    const dynamics = createBurstDynamics(random())
    const slot = dynamics.burst(source())
    const pieces = slot.particles.filter(particle => particle.alive && !particle.mote)
    const sizes = pieces.map(particle => particle.size), speeds = pieces.map(particle => particle.velocity.length())
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThan(5)
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeGreaterThan(2)
    expect(new Set(pieces.map(particle => particle.color.getHex())).size).toBeGreaterThan(14)
    expect(Math.max(...pieces.map(p => p.roughness)) - Math.min(...pieces.map(p => p.roughness))).toBeGreaterThan(.5)
    expect(pieces.every(particle => particle.color.r > particle.color.g && particle.color.r > particle.color.b)).toBe(true)
    const next = dynamics.burst(source())
    expect(next.particles[0].velocity.distanceTo(pieces[0].velocity)).toBeGreaterThan(.1)
  })

  test('falling liquid deposits on impact and follows a moving, rotating, inflating host', () => {
    const dynamics = createBurstDynamics(random()), particle = dynamics.slots[0].particles[0]
    particle.alive = true; particle.age = .1; particle.lifetime = 2; particle.size = .04
    particle.position.set(0, .61, 0); particle.velocity.set(0, -3, 0)
    const body = cube()
    dynamics.step(1 / 60, gravity, [body])
    expect(particle.alive).toBe(false)
    expect(dynamics.surfaceCount).toBe(1)
    const drop = dynamics.deposits.find(d => d.alive)!
    expect(drop.position.y).toBeCloseTo(.6)
    body.position.set(2, 3, 1); body.rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
    body.halfSize.multiplyScalar(1.5)
    for (let i = 0; i < 600; i++) dynamics.step(1 / 60, gravity, [body])
    expect(drop.alive).toBe(true)
    expect(drop.position.distanceTo(new THREE.Vector3(1.1, 3, 1))).toBeLessThan(.00001)
    body.enabled = false
    dynamics.step(1 / 60, gravity, [body])
    expect(dynamics.surfaceCount).toBe(0)
  })

  test('airborne drops stretch along velocity while preserving volume', () => {
    const dynamics = createBurstDynamics(random()), slot = dynamics.burst(source())
    dynamics.step(.1, gravity)
    const particle = slot.particles.find(p => p.alive && !p.mote)!
    expect(particle.proportions.y).toBeGreaterThan(1)
    expect(particle.proportions.x * particle.proportions.y * particle.proportions.z).toBeCloseTo(1, 6)
    expect(new THREE.Vector3(0, 1, 0).applyQuaternion(particle.rotation).dot(particle.velocity.clone().normalize())).toBeGreaterThan(.98)
  })

  test('oil starts as joined lobes, stretches under motion, then pinches apart', () => {
    const dynamics = createBurstDynamics(random()), slot = dynamics.burst(source())
    const linked = slot.particles.find(p => p.link >= 0)!
    const leading = slot.particles[linked.link]
    const startDistance = linked.position.distanceTo(leading.position)
    expect(slot.particles.filter(p => p.link >= 0).length).toBeGreaterThan(4)
    for (let i = 0; i < 20; i++) dynamics.step(1 / 120, gravity)
    expect(linked.position.distanceTo(leading.position)).toBeGreaterThan(startDistance)
    expect(linked.neck).toBeGreaterThan(.1)
    const firstShape = leading.proportions.clone()
    for (let i = 0; i < 30; i++) dynamics.step(1 / 120, gravity)
    expect(firstShape.distanceTo(leading.proportions)).toBeGreaterThan(.03)
    for (let i = 0; i < 140; i++) dynamics.step(1 / 120, gravity)
    expect(slot.particles.every(p => p.link < 0)).toBe(true)
    expect(slot.particles.some(p => p.alive && !p.mote)).toBe(true)
  })

  test('oil connectors break instead of spanning through a tile', () => {
    const dynamics = createBurstDynamics(random()), slot = dynamics.burst(source())
    const trailing = slot.particles.find(p => p.link >= 0)!, leading = slot.particles[trailing.link]
    leading.position.set(-.8, 0, 0); trailing.position.set(.8, 0, 0)
    leading.size = trailing.size = .18
    leading.velocity.set(0, 0, 0); trailing.velocity.set(0, 0, 0)
    dynamics.step(1 / 120, gravity, [cube()])
    expect(trailing.link).toBe(-1)
    expect(trailing.neck).toBe(0)
  })

  test('neighboring wet drops merge and large hanging drops detach as liquid', () => {
    const dynamics = createBurstDynamics(random()), body = cube()
    const pour = () => {
      const particle = dynamics.slots[0].particles[0]
      particle.alive = true; particle.age = .1; particle.lifetime = 2; particle.size = .07; particle.finish = 'coral'
      particle.position.set(0, .63, 0); particle.velocity.set(0, -2, 0)
      dynamics.step(1 / 60, gravity, [body])
    }
    pour(); pour()
    expect(dynamics.surfaceCount).toBe(1)
    const drop = dynamics.deposits.find(d => d.alive)!
    expect(drop.size ** 3).toBeCloseTo(2 * .07 ** 3, 6)
    body.rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI)
    for (let i = 0; i < 100; i++) dynamics.step(1 / 60, gravity, [body])
    expect(drop.alive).toBe(false)
    const drips = dynamics.slots.flatMap(s => s.particles).filter(p => p.alive && !p.mote && p.finish === 'coral')
    expect(drips.length).toBe(1)
    expect(drips[0].position.y).toBeLessThan(-.7)
    expect(drips[0].velocity.y).toBeLessThan(0)
  })

  test('persistent wet marks survive later bursts and use a bounded pool', () => {
    const dynamics = createBurstDynamics(random()), body = cube(), particle = dynamics.slots[0].particles[0]
    particle.alive = true; particle.age = .1; particle.size = .025
    particle.position.set(0, .61, 0); particle.velocity.set(0, -2, 0)
    dynamics.step(1 / 60, gravity, [body])
    for (let i = 0; i < 12; i++) dynamics.burst(source())
    expect(dynamics.surfaceCount).toBe(1)
    expect(dynamics.deposits.length).toBe(SURFACE_DROPS)
    dynamics.reset()
    expect(dynamics.active).toBe(false)
  })

  test('renderer uses rounded, glossy liquid with source colors and clears airborne pools', () => {
    const parent = new THREE.Group()
    const glass = new THREE.MeshPhysicalMaterial({ color: '#ddccff', transmission: .92, roughness: .12, thickness: .4 })
    const coral = new THREE.MeshPhysicalMaterial({ color: '#f18f86', roughness: .34, transmission: 0 })
    const effects = createBurstEffects(parent, { glass, coral })
    effects.burst(source('glass')); effects.update(.05)
    const meshes: THREE.InstancedMesh[] = []
    parent.traverse(object => { if (object instanceof THREE.InstancedMesh) meshes.push(object) })
    const glassBatch = meshes.find(mesh => (mesh.material as THREE.MeshPhysicalMaterial).transmission > .7)!
    expect(glassBatch.visible).toBe(true)
    expect((glassBatch.material as THREE.MeshPhysicalMaterial).transmission).toBe(.78)
    expect((glassBatch.material as THREE.MeshPhysicalMaterial).roughness).toBeLessThan(.2)
    expect((glassBatch.material as THREE.MeshPhysicalMaterial).ior).toBe(1.46)
    expect(glassBatch.geometry.getAttribute('fragmentFinish')).toBeDefined()
    expect(glassBatch.geometry.getAttribute('surfaceAnchor')).toBeDefined()
    expect(glassBatch.geometry.getAttribute('oilMotion')).toBeDefined()
    expect(effects.oilStrands).toBeGreaterThan(0)
    expect(glassBatch.geometry.type).toBe('SphereGeometry')
    effects.burst(source('coral')); effects.update(.05)
    expect(meshes.every(mesh => mesh.visible)).toBe(true)
    for (let i = 0; i < 210; i++) effects.update(1 / 60)
    expect(effects.activeFragments).toBe(0)
    expect(meshes.every(mesh => !mesh.visible)).toBe(true)
    effects.dispose(); glass.dispose(); coral.dispose()
  })
})

test('tiny spheres have their own quieter, shorter, higher-pitched sound profile', () => {
  const tiny = burstSoundProfile(.115, true), larger = burstSoundProfile(.27, true), cube = burstSoundProfile(1.1, false)
  expect(tiny.kind).toBe('tiny')
  expect(larger.kind).toBe('tiny')
  expect(tiny.gain).toBeLessThan(larger.gain)
  expect(larger.gain).toBeLessThan(cube.gain * .4)
  expect(tiny.rate).toBeGreaterThan(larger.rate)
  expect(cube.kind).toBe('large')
})
