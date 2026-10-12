import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createBurstDynamics, integrateDebris, type BurstSource } from '../src/burstDynamics'
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

describe('varied physical debris', () => {
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
    expect(new Set(pieces.map(particle => particle.color.getHex())).size).toBeGreaterThan(30)
    expect(Math.max(...pieces.map(p => p.roughness)) - Math.min(...pieces.map(p => p.roughness))).toBeGreaterThan(1)
    expect(pieces.every(particle => particle.color.r > particle.color.g && particle.color.r > particle.color.b)).toBe(true)
    const next = dynamics.burst(source())
    expect(next.particles[0].velocity.distanceTo(pieces[0].velocity)).toBeGreaterThan(.1)
  })

  test('a falling solid fragment rebounds from a nearby cube surface', () => {
    const dynamics = createBurstDynamics(random()), particle = dynamics.slots[0].particles[0]
    particle.alive = true; particle.age = .1; particle.lifetime = 2; particle.size = .04
    particle.position.set(0, .61, 0); particle.velocity.set(0, -3, 0)
    const cube: WireBody = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.6, .6, .6), radius: 1, mass: 1, shapePower: 3.8 }
    dynamics.step(1 / 60, new THREE.Vector3(0, -7.8, 0), [cube])
    expect(particle.position.y).toBeGreaterThan(.64)
    expect(particle.velocity.y).toBeGreaterThan(0)
  })

  test('renderer preserves source transmission and roughness, then clears spent pools', () => {
    const parent = new THREE.Group()
    const glass = new THREE.MeshPhysicalMaterial({ color: '#ddccff', transmission: .92, roughness: .12, thickness: .4 })
    const coral = new THREE.MeshPhysicalMaterial({ color: '#f18f86', roughness: .34, transmission: 0 })
    const effects = createBurstEffects(parent, { glass, coral })
    effects.burst(source('glass')); effects.update(.05)
    const meshes: THREE.InstancedMesh[] = []
    parent.traverse(object => { if (object instanceof THREE.InstancedMesh) meshes.push(object) })
    const glassBatch = meshes.find(mesh => (mesh.material as THREE.MeshPhysicalMaterial).transmission > 0)!
    expect(glassBatch.visible).toBe(true)
    expect((glassBatch.material as THREE.MeshPhysicalMaterial).transmission).toBe(.92)
    expect((glassBatch.material as THREE.MeshPhysicalMaterial).roughness).toBe(.12)
    expect(glassBatch.geometry.getAttribute('fragmentFinish')).toBeDefined()
    effects.burst(source('coral')); effects.update(.05)
    expect(meshes.every(mesh => mesh.visible)).toBe(true)
    for (let i = 0; i < 150; i++) effects.update(1 / 60)
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
