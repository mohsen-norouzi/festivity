import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createBurstLifecycle, INFLATE_SECONDS, type BurstBody } from '../src/burstLifecycle'
import { createOrbits } from '../src/orbits'

const dt = 1 / 90
const makeBody = (): BurstBody => ({
  home: new THREE.Vector3(1, 0, 0), position: new THREE.Vector3(1, 0, 0), previous: new THREE.Vector3(1, 0, 0),
  velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.7, .7, .6),
  shapePower: 3.8, mass: 1, radius: 1,
})

describe('hold, burst, and replacement', () => {
  test('inflates collision dimensions and smoothly deflates after an early release', () => {
    const body = makeBody(), start = body.halfSize.clone()
    let pops = 0
    const life = createBurstLifecycle([body], () => pops++, () => {})
    life.setTarget(0)
    for (let i = 0; i < 65; i++) life.step(dt)
    expect(body.radius).toBeGreaterThan(1.25)
    expect(body.halfSize.x / start.x).toBeCloseTo(body.radius)
    expect(life.scale(0)).toBeCloseTo(body.radius)
    life.setTarget(-1)
    for (let i = 0; i < 90; i++) life.step(dt)
    expect(pops).toBe(0)
    expect(body.radius).toBeCloseTo(1, 3)
    expect(body.mass).toBe(1)
  })

  test('bursts once per hold, disappears, then brings a full-size matching body in from outside', () => {
    const body = makeBody()
    let pops = 0, spawns = 0
    const life = createBurstLifecycle([body], () => pops++, (_index, incoming) => { spawns++; incoming.position.set(10, 0, 0) })
    life.setTarget(0)
    for (let i = 0; i < Math.ceil(INFLATE_SECONDS / dt) + 1; i++) life.step(dt)
    expect(pops).toBe(1)
    expect(body.enabled).toBe(false)
    expect(life.canGrab(0)).toBe(false)
    for (let i = 0; i < 28; i++) life.step(dt)
    expect(spawns).toBe(1)
    expect(body.enabled).toBe(true)
    expect(body.position.x).toBe(10)
    expect(body.previous.equals(body.position)).toBe(true)
    expect(body.radius).toBe(1)
    body.position.copy(body.home)
    for (let i = 0; i < 400; i++) { life.setTarget(0); life.step(dt) }
    expect(pops).toBe(1)
    expect(life.canGrab(0)).toBe(true)
    life.setTarget(-1); life.setTarget(0)
    for (let i = 0; i < 125; i++) life.step(dt)
    expect(pops).toBe(2)
  })

  test('a popped glass instance is hidden and excluded from simulation until replacement', () => {
    const parent = new THREE.Group(), orbits = createOrbits(parent)
    const life = createBurstLifecycle(orbits.bubbleBodies, () => {}, (_i, body) => body.position.set(9, 0, 0))
    life.setTarget(3)
    for (let i = 0; i < 123; i++) { life.step(dt); orbits.step(dt, [], i * dt) }
    const sphere = orbits.bubbleBodies[3], location = sphere.position.clone()
    orbits.update()
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3()
    orbits.bubbleMesh.getMatrixAt(3, matrix)
    scale.setFromMatrixScale(matrix)
    expect(scale.length()).toBe(0)
    orbits.step(dt, [], 2)
    expect(sphere.position.equals(location)).toBe(true)
    for (let i = 0; i < 28; i++) life.step(dt)
    orbits.update()
    orbits.bubbleMesh.getMatrixAt(3, matrix)
    scale.setFromMatrixScale(matrix)
    expect(scale.x).toBeCloseTo(.14)
    expect(sphere.position.x).toBe(9)
    orbits.dispose()
  })

  test('reset restores every body and cancels pending replacement', () => {
    const body = makeBody()
    let spawns = 0
    const life = createBurstLifecycle([body], () => {}, () => spawns++)
    life.setTarget(0)
    for (let i = 0; i < 123; i++) life.step(dt)
    life.reset()
    for (let i = 0; i < 300; i++) life.step(dt)
    expect(spawns).toBe(0)
    expect(life.pops).toBe(0)
    expect(body.enabled).toBe(true)
    expect(body.radius).toBe(1)
    expect(life.canGrab(0)).toBe(true)
  })
})
