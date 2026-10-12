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
