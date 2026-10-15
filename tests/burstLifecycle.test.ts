import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createBurstLifecycle, INFLATION_SECONDS, type BurstBody } from '../src/burstLifecycle'
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

describe('single-click inflation, burst, and replacement', () => {
  test('idle shapes stay still; one click continuously grows the rendering and collider together', () => {
    const body = makeBody(), start = body.halfSize.clone()
    const life = createBurstLifecycle([body], () => {}, () => {})
    advance(life, 5)
    expect(body.radius).toBe(1)
    expect(life.states[0].phase).toBe('live')
    expect(life.start(0)).toBe(true)
    advance(life, .7)
    const firstRadius = body.radius
    expect(firstRadius).toBeGreaterThan(1.1)
    expect(body.halfSize.x / start.x).toBeCloseTo(body.radius)
    expect(life.scale(0)).toBeCloseTo(body.radius)
    advance(life, .7)
    expect(body.radius).toBeGreaterThan(firstRadius)
    expect(life.states[0].charge).toBeGreaterThan(.5)
    expect(life.pops).toBe(0)
    expect(body.mass).toBe(1)
  })

  test('repeated clicks neither restart nor accelerate an active countdown', () => {
    const repeated = createBurstLifecycle([makeBody()], () => {}, () => {})
    const once = createBurstLifecycle([makeBody()], () => {}, () => {})
    repeated.start(0); once.start(0)
    for (let i = 0; i < Math.ceil(INFLATION_SECONDS / dt) + 1; i++) {
      expect(repeated.start(0)).toBe(false)
      repeated.step(dt); once.step(dt)
      expect(repeated.scale(0)).toBeCloseTo(once.scale(0), 9)
      expect(repeated.pops).toBe(once.pops)
    }
    expect(repeated.pops).toBe(1)
  })

  test('one click pops once, then a fresh replacement flies in and waits for another click', () => {
    const body = makeBody()
    let pops = 0, spawns = 0
    const life = createBurstLifecycle([body], () => pops++, (_index, incoming) => { spawns++; incoming.position.set(10, 0, 0) })
    life.start(0)
    advance(life, INFLATION_SECONDS - .2)
    expect(pops).toBe(0)
    expect(body.radius).toBeGreaterThan(1.5)
    expect(life.canGrab(0)).toBe(true)
    advance(life, .21)
    expect(pops).toBe(1)
    expect(body.enabled).toBe(false)
    expect(life.canGrab(0)).toBe(false)
    expect(life.start(0)).toBe(false)
    advance(life, .32)
    expect(spawns).toBe(1)
    expect(body.enabled).toBe(true)
    expect(body.position.x).toBe(10)
    expect(body.previous.equals(body.position)).toBe(true)
    expect(body.radius).toBe(1)
    expect(life.states[0].charge).toBe(0)
    expect(life.start(0)).toBe(false)
    body.position.copy(body.home)
    advance(life, 4)
    expect(pops).toBe(1)
    expect(life.canGrab(0)).toBe(true)
    expect(life.start(0)).toBe(true)
    advance(life, INFLATION_SECONDS + .01)
    expect(pops).toBe(2)
  })

  test('another selection starts its own inflation without cancelling the first', () => {
    const burstOrder: number[] = []
    const life = createBurstLifecycle([makeBody(), makeBody()], index => burstOrder.push(index), () => {})
    life.start(0)
    advance(life, .6)
    life.start(1)
    advance(life, INFLATION_SECONDS - .59)
    expect(burstOrder).toEqual([0])
    expect(life.states[1].phase).toBe('inflating')
    expect(life.states[1].charge).toBeGreaterThan(.7)
    advance(life, .6)
    expect(burstOrder).toEqual([0, 1])
  })

  test('a sphere grows from one click and is hidden until its matching replacement', () => {
    const parent = new THREE.Group(), orbits = createOrbits(parent)
    const life = createBurstLifecycle(orbits.bubbleBodies, () => {}, (_i, body) => body.position.set(9, 0, 0))
    life.start(3)
    advance(life, INFLATION_SECONDS + .01)
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

  test('reset cancels every countdown and restores the original dimensions', () => {
    const bodies = [makeBody(), makeBody()]
    let spawns = 0
    const life = createBurstLifecycle(bodies, () => {}, () => spawns++)
    life.start(0); advance(life, .5); life.start(1); advance(life, 1)
    life.reset()
    advance(life, 5)
    expect(spawns).toBe(0)
    expect(life.pops).toBe(0)
    bodies.forEach((body, i) => {
      expect(life.states[i].charge).toBe(0)
      expect(body.enabled).toBe(true)
      expect(body.radius).toBe(1)
      expect(life.canGrab(i)).toBe(true)
    })
  })

  test('unavailable bodies cannot be selected or start a countdown', () => {
    const body = makeBody(); body.enabled = false
    const life = createBurstLifecycle([body], () => {}, () => {})
    expect(life.start(0)).toBe(false)
    expect(life.start(-1)).toBe(false)
    expect(life.start(9)).toBe(false)
    expect(life.canGrab(0)).toBe(false)
    advance(life, 5)
    expect(life.pops).toBe(0)
  })
})


test('restoring a departed balloon leaves its neighbors and their motion untouched', () => {
  const bodies = [makeBody(), makeBody()]
  let controlled: number | null = 2.4
  const life = createBurstLifecycle(bodies, () => {}, () => {}, () => 1, index => index === 0 ? controlled : null)
  life.step(dt)
  bodies[0].enabled = false
  bodies[1].velocity.set(1, 2, 3)
  life.start(1); advance(life, .3)
  const neighbor = { ...life.states[1] }, neighborRadius = bodies[1].radius
  controlled = null
  life.restore(0)
  expect(life.canGrab(0)).toBe(true)
  expect(bodies[0].radius).toBe(1)
  expect(life.scale(0, 0)).toBe(1)
  expect(life.states[1]).toEqual(neighbor)
  expect(bodies[1].radius).toBe(neighborRadius)
  expect(bodies[1].velocity.toArray()).toEqual([1, 2, 3])
})
