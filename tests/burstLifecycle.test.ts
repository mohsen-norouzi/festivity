import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createBurstLifecycle, PUFFS_TO_POP, FINAL_PUFF_SECONDS, type BurstBody } from '../src/burstLifecycle'
import { createOrbits } from '../src/orbits'

const dt = 1 / 90
const makeBody = (): BurstBody => ({
  home: new THREE.Vector3(1, 0, 0), position: new THREE.Vector3(1, 0, 0), previous: new THREE.Vector3(1, 0, 0),
  velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.7, .7, .6),
  shapePower: 3.8, mass: 1, radius: 1,
})
const advance = (life: ReturnType<typeof createBurstLifecycle>, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / dt); i++) life.step(dt)
}

describe('click to puff, burst, and replacement', () => {
  test('time alone never inflates; one click adds one lasting puff with matching collision dimensions', () => {
    const body = makeBody(), start = body.halfSize.clone()
    const life = createBurstLifecycle([body], () => {}, () => {})
    advance(life, 5)
    expect(body.radius).toBe(1)
    expect(life.states[0].puffs).toBe(0)
    life.puff(0)
    advance(life, .35)
    expect(body.radius).toBeGreaterThan(1.1)
    expect(body.halfSize.x / start.x).toBeCloseTo(body.radius)
    expect(life.scale(0)).toBeCloseTo(body.radius)
    advance(life, 10)
    expect(life.states[0].puffs).toBe(1)
    expect(life.pops).toBe(0)
    expect(body.radius).toBeCloseTo(1 + .58 / PUFFS_TO_POP, 4)
    expect(body.mass).toBe(1)
  })

  test('five clicks cause one pop, then a fresh dry replacement comes from outside', () => {
    const body = makeBody()
    let pops = 0, spawns = 0
    const life = createBurstLifecycle([body], () => pops++, (_index, incoming) => { spawns++; incoming.position.set(10, 0, 0) })
    for (let i = 0; i < PUFFS_TO_POP - 1; i++) { expect(life.puff(0)).toBe(true); advance(life, .12) }
    expect(pops).toBe(0)
    expect(body.radius).toBeGreaterThan(1.4)
    expect(life.puff(0)).toBe(true)
    expect(life.puff(0)).toBe(false)
    advance(life, FINAL_PUFF_SECONDS + .01)
    expect(pops).toBe(1)
    expect(body.enabled).toBe(false)
    expect(life.canGrab(0)).toBe(false)
    advance(life, .32)
    expect(spawns).toBe(1)
    expect(body.enabled).toBe(true)
    expect(body.position.x).toBe(10)
    expect(body.previous.equals(body.position)).toBe(true)
    expect(body.radius).toBe(1)
    expect(life.states[0].puffs).toBe(0)
    expect(life.puff(0)).toBe(false)
    body.position.copy(body.home)
    advance(life, 4)
    expect(pops).toBe(1)
    expect(life.canGrab(0)).toBe(true)
  })

  test('a popped sphere is hidden until replacement and uses the same discrete puff interaction', () => {
    const parent = new THREE.Group(), orbits = createOrbits(parent)
    const life = createBurstLifecycle(orbits.bubbleBodies, () => {}, (_i, body) => body.position.set(9, 0, 0))
    for (let i = 0; i < PUFFS_TO_POP; i++) life.puff(3)
    advance(life, FINAL_PUFF_SECONDS + .01)
    const sphere = orbits.bubbleBodies[3], location = sphere.position.clone()
    orbits.update()
    const matrix = new THREE.Matrix4(), scale = new THREE.Vector3()
    orbits.bubbleMesh.getMatrixAt(3, matrix)
    scale.setFromMatrixScale(matrix)
    expect(scale.length()).toBe(0)
    orbits.step(dt, [], 2)
    expect(sphere.position.equals(location)).toBe(true)
    advance(life, .32)
    orbits.update()
    orbits.bubbleMesh.getMatrixAt(3, matrix)
    scale.setFromMatrixScale(matrix)
    expect(scale.x).toBeCloseTo(.14)
    expect(sphere.position.x).toBe(9)
    orbits.dispose()
  })

  test('reset clears accumulated pressure and cancels the final puff', () => {
    const body = makeBody()
    let spawns = 0
    const life = createBurstLifecycle([body], () => {}, () => spawns++)
    for (let i = 0; i < PUFFS_TO_POP; i++) life.puff(0)
    life.reset()
    advance(life, 5)
    expect(spawns).toBe(0)
    expect(life.pops).toBe(0)
    expect(life.states[0].puffs).toBe(0)
    expect(body.enabled).toBe(true)
    expect(body.radius).toBe(1)
    expect(life.canGrab(0)).toBe(true)
  })
})
