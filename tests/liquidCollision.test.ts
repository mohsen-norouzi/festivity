import { expect, test } from 'bun:test'
import * as THREE from 'three'
import { createLiquidContacts } from '../src/liquidCollision'
import { createBurstDynamics } from '../src/burstDynamics'
import type { WireBody } from '../src/wirePhysics'

const body = (): WireBody => ({
  position: new THREE.Vector3(), velocity: new THREE.Vector3(), spin: new THREE.Vector3(),
  rotation: new THREE.Quaternion(), halfSize: new THREE.Vector3(.06, .6, .6), radius: .9, mass: 1, shapePower: 3.8,
})

test('sweeps the whole path through a thin rotated tile even with both endpoints outside', () => {
  const contacts = createLiquidContacts(), tile = body()
  tile.rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), .5)
  contacts.prepare([tile])
  const hit = contacts.sweep(new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0), .04)
  expect(hit?.index).toBe(0)
  expect(hit!.time).toBeGreaterThan(.4)
  expect(hit!.time).toBeLessThan(.5)
})

test('a cube sweeping through a stationary drop still catches it', () => {
  const contacts = createLiquidContacts(), tile = body()
  tile.position.x = -1
  contacts.prepare([tile]); contacts.commit()
  tile.position.x = 1
  contacts.prepare([tile])
  const hit = contacts.sweep(new THREE.Vector3(), new THREE.Vector3(), .03)
  expect(hit?.index).toBe(0)
  expect(hit!.time).toBeLessThan(.5)
})

test('drop width catches a rounded edge that the center line misses', () => {
  const contacts = createLiquidContacts(), tile = body()
  tile.halfSize.set(.6, .6, .6); tile.radius = 1
  contacts.prepare([tile])
  const from = new THREE.Vector3(-2, .68, 0), to = new THREE.Vector3(2, .68, 0)
  expect(contacts.sweep(from, to, 0)).toBeUndefined()
  expect(contacts.sweep(from, to, .11)?.index).toBe(0)
})

test('the earliest cube receives the oil regardless of body array order', () => {
  const contacts = createLiquidContacts(), near = body(), far = body()
  near.position.x = -.6; far.position.x = .6
  contacts.prepare([far, near])
  expect(contacts.sweep(new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0), .02)?.index).toBe(1)
})

test('replacement teleportation does not sweep oil across the scene', () => {
  const contacts = createLiquidContacts(), tile = body()
  tile.position.x = -2; tile.enabled = false
  contacts.prepare([tile]); contacts.commit()
  tile.position.x = 2; tile.enabled = true
  contacts.prepare([tile])
  expect(contacts.sweep(new THREE.Vector3(), new THREE.Vector3(), .02)).toBeUndefined()
})

test('a newborn fast drop deposits immediately instead of passing through on its first frame', () => {
  const dynamics = createBurstDynamics(), tile = body(), particle = dynamics.slots[0].particles[0]
  particle.alive = true; particle.age = 0; particle.lifetime = 2; particle.size = .025; particle.finish = 'coral'
  particle.position.set(-1, 0, 0); particle.velocity.set(200, 0, 0)
  dynamics.step(1 / 90, new THREE.Vector3(0, -7.8, 0), [tile])
  expect(particle.alive).toBe(false)
  expect(dynamics.surfaceCount).toBe(1)
  expect(dynamics.deposits.find(drop => drop.alive)!.position.x).toBeLessThan(0)
})

test('a departing drip is not recaptured by the conservative collision margin', () => {
  const dynamics = createBurstDynamics(), tile = body(), particle = dynamics.slots[0].particles[0]
  tile.halfSize.set(.6, .6, .6); tile.radius = 1
  particle.alive = true; particle.lifetime = 3; particle.size = .04
  particle.position.set(0, -.65, 0); particle.velocity.set(0, -.25, 0)
  const gravity = new THREE.Vector3(0, -7.8, 0)
  let previousY = particle.position.y
  for (let i = 0; i < 180; i++) {
    dynamics.step(1 / 90, gravity, [tile])
    expect(particle.alive).toBe(true)
    expect(dynamics.surfaceCount).toBe(0)
    expect(particle.position.y).toBeLessThan(previousY)
    previousY = particle.position.y
  }
})

test('a real returning impact still attaches after a drop has cleared its host', () => {
  const dynamics = createBurstDynamics(), tile = body(), particle = dynamics.slots[0].particles[0]
  tile.halfSize.set(.6, .6, .6); tile.radius = 1
  particle.alive = true; particle.lifetime = 3; particle.size = .04
  particle.position.set(0, -.8, 0); particle.velocity.set(0, 2, 0)
  for (let i = 0; i < 12; i++) dynamics.step(1 / 90, new THREE.Vector3(), [tile])
  expect(particle.alive).toBe(false)
  expect(dynamics.surfaceCount).toBe(1)
  expect(dynamics.deposits.find(drop => drop.alive)!.position.y).toBeCloseTo(-.6)
})

test('a snagged strand tears without teleporting either falling lobe onto the obstacle', () => {
  const dynamics = createBurstDynamics(), tile = body()
  tile.halfSize.set(.6, .6, .6); tile.radius = 1
  const [a, b] = dynamics.slots[0].particles
  for (const particle of [a, b]) {
    particle.alive = true; particle.lifetime = 3; particle.size = .16
    particle.velocity.set(0, -.3, 0); particle.finish = 'coral'
  }
  a.position.set(-.98, 0, 0); b.position.set(.98, 0, 0)
  b.link = 0; b.neck = .9; b.restLength = 1.96; b.separationAge = 1
  dynamics.step(1 / 90, new THREE.Vector3(0, -7.8, 0), [tile])
  expect(b.link).toBe(-1)
  expect(b.neck).toBe(0)
  expect(a.alive && b.alive).toBe(true)
  expect(a.position.x).toBeCloseTo(-.98, 4)
  expect(b.position.x).toBeCloseTo(.98, 4)
  expect(a.position.y).toBeLessThan(0)
  expect(b.position.y).toBeLessThan(0)
  expect(dynamics.surfaceCount).toBe(0)
})
