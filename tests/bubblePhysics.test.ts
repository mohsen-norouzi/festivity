import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createBubblePhysics, type BubbleBody } from '../src/bubblePhysics'
import { createWirePhysics, WIRE_RADIUS, type WireBody } from '../src/wirePhysics'
import { createOrbits } from '../src/orbits'

const dt = 1 / 90
const makeCube = (position = new THREE.Vector3()): WireBody => ({
  position: position.clone(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(.23, .31, -.2)),
  spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.65, .58, .52), shapePower: 3.8, mass: .85, radius: 1,
})
// Independently sample the entire bubble surface against the cube's real shape.
const surfaceClearance = (bubble: BubbleBody, cube: WireBody) => {
  const point = new THREE.Vector3(), inverse = cube.rotation.clone().invert()
  let minimum = Infinity
  for (let i = 0; i < 256; i++) {
    const y = 1 - 2 * (i + .5) / 256, r = Math.sqrt(1 - y * y), angle = i * Math.PI * (3 - Math.sqrt(5))
    point.set(r * Math.cos(angle), y, r * Math.sin(angle)).multiplyScalar(bubble.radius).add(bubble.position).sub(cube.position).applyQuaternion(inverse)
    minimum = Math.min(minimum, (Math.abs(point.x / cube.halfSize.x) ** cube.shapePower + Math.abs(point.y / cube.halfSize.y) ** cube.shapePower + Math.abs(point.z / cube.halfSize.z) ** cube.shapePower) ** (1 / cube.shapePower))
  }
  return minimum
}

describe('physical glass bubbles', () => {
  test('the rendered glass sphere moves when a cube crosses its silhouette at another depth', () => {
    const parent = new THREE.Group(), orbits = createOrbits(parent)
    const bubble = orbits.bubbleBodies[3]
    const initial = bubble.position.clone()
    const cube = makeCube(initial.clone().add(new THREE.Vector3(-.78, 0, 3)))
    cube.velocity.set(3, 0, 0)
    for (let i = 0; i < 18; i++) {
      cube.position.x += 3 * dt
      orbits.step(dt, [cube], i * dt)
    }
    orbits.update()
    const matrix = new THREE.Matrix4(), rendered = new THREE.Vector3()
    orbits.bubbleMesh.getMatrixAt(3, matrix)
    rendered.setFromMatrixPosition(matrix)
    expect(rendered.distanceTo(bubble.position)).toBeLessThan(.000001)
    expect(rendered.x - initial.x).toBeGreaterThan(.35)
    expect(Math.abs(rendered.z - initial.z)).toBeLessThan(.02)
    expect(bubble.velocity.x).toBeGreaterThan(.5)
    orbits.dispose()
  })

  test('the glass sphere instance can be hit and dragged, then yields to a cube', () => {
    const parent = new THREE.Group(), orbits = createOrbits(parent)
    const bubble = orbits.bubbleBodies[3], start = bubble.position.clone()
    parent.updateMatrixWorld(true)
    const raycaster = new THREE.Raycaster(start.clone().add(new THREE.Vector3(0, 0, 10)), new THREE.Vector3(0, 0, -1))
    const hit = raycaster.intersectObject(orbits.bubbleMesh)[0]
    expect(hit.instanceId).toBe(3)
    const interaction = { hover: false, dragging: hit.instanceId!, pointer: start, dragTarget: start.clone().add(new THREE.Vector3(1, .3, 0)), velocity: new THREE.Vector3() }
    for (let i = 0; i < 60; i++) orbits.step(dt, [], i * dt, false, interaction)
    orbits.update()
    expect(bubble.position.x - start.x).toBeGreaterThan(.7)
    const cube = makeCube(bubble.position.clone().add(new THREE.Vector3(-.2, 0, 2)))
    for (let i = 0; i < 30; i++) orbits.step(dt, [cube], i * dt, false, interaction)
    expect(bubble.position.x - cube.position.x).toBeGreaterThan(.5)
    orbits.dispose()
  })

  test('clear the faces and rounded corners of rotating cubes, with mutual response', () => {
    let worstClearance = Infinity, cubeReaction = 0
    for (const location of [[.68, 0, 0], [.51, .48, .37], [0, 0, 0]]) {
      const bubbles = createBubblePhysics(), cube = makeCube(), bubble = bubbles.bodies[0]
      bubble.position.set(location[0], location[1], location[2]).applyQuaternion(cube.rotation)
      bubble.velocity.copy(bubble.position).normalize().multiplyScalar(-2)
      const start = cube.position.clone()
      bubbles.beginStep(dt, [cube], 0, true)
      for (let i = 0; i < 6; i++) bubbles.solveContacts([cube])
      worstClearance = Math.min(worstClearance, surfaceClearance(bubble, cube))
      cubeReaction += cube.position.distanceTo(start) + cube.velocity.length()
    }
    expect(worstClearance).toBeGreaterThan(1)
    expect(cubeReaction).toBeGreaterThan(.001)
  })

  test('the smallest bubble cannot hide between cable nodes and pushes back on the wire', () => {
    const wire = createWirePhysics(), bubbles = createBubblePhysics(), bubble = bubbles.bodies[4]
    bubble.position.lerpVectors(wire.positions[3], wire.positions[4], .23).add(new THREE.Vector3(0, .01, 0))
    const start = bubble.position.clone(), node = wire.positions[3].clone()
    wire.step(dt, [bubble], 0)
    const curve = new THREE.CatmullRomCurve3(wire.positions, true, 'centripetal'), point = new THREE.Vector3()
    let clearance = Infinity
    for (let i = 0; i < 1024; i++) clearance = Math.min(clearance, curve.getPoint(i / 1024, point).distanceTo(bubble.position) - bubble.radius - WIRE_RADIUS)
    expect(clearance).toBeGreaterThan(0)
    expect(bubble.position.distanceTo(start)).toBeGreaterThan(.02)
    expect(wire.positions[3].distanceTo(node)).toBeGreaterThan(.005)
    expect(bubble.velocity.length()).toBeGreaterThan(0)
  })

  test('a bubble squeezed against the cable by a moving cube stays outside both', () => {
    const wire = createWirePhysics(), bubbles = createBubblePhysics(), bubble = bubbles.bodies[1]
    const anchor = wire.positions[5].clone()
    bubble.home.copy(anchor).add(new THREE.Vector3(0, .12, 0))
    bubble.position.copy(bubble.home)
    const cube = makeCube(anchor.clone().add(new THREE.Vector3(0, -.55, 0)))
    const cubes = [cube], colliders = [cube, ...bubbles.bodies]
    let minimumCube = Infinity, minimumWire = Infinity, minimumWireCube = Infinity
    const point = new THREE.Vector3(), local = new THREE.Vector3(), inverse = new THREE.Quaternion()
    for (let step = 0; step < 360; step++) {
      cube.position.copy(anchor).add(new THREE.Vector3(Math.sin(step * .025) * .25, -.52 + Math.sin(step * .017) * .15, 0))
      cube.velocity.set(Math.cos(step * .025) * .5625, Math.cos(step * .017) * .2295, 0)
      cube.rotation.setFromEuler(new THREE.Euler(.23, step * .002, -.2))
      bubbles.beginStep(dt, cubes, step * dt)
      wire.step(dt, colliders, step * dt, false, () => bubbles.solveContacts(cubes))
      if (step < 10) continue
      minimumCube = Math.min(minimumCube, surfaceClearance(bubble, cube))
      const curve = new THREE.CatmullRomCurve3(wire.positions, true, 'centripetal')
      inverse.copy(cube.rotation).invert()
      for (let i = 0; i < 512; i++) {
        minimumWire = Math.min(minimumWire, curve.getPoint(i / 512, point).distanceTo(bubble.position) - bubble.radius - WIRE_RADIUS)
        local.copy(point).sub(cube.position).applyQuaternion(inverse)
        minimumWireCube = Math.min(minimumWireCube, (Math.abs(local.x / (cube.halfSize.x + WIRE_RADIUS)) ** cube.shapePower + Math.abs(local.y / (cube.halfSize.y + WIRE_RADIUS)) ** cube.shapePower + Math.abs(local.z / (cube.halfSize.z + WIRE_RADIUS)) ** cube.shapePower) ** (1 / cube.shapePower))
      }
    }
    expect(minimumCube).toBeGreaterThan(.999)
    expect(minimumWire).toBeGreaterThan(-.001)
    expect(minimumWireCube).toBeGreaterThan(.995)
    expect(bubbles.bodies.every(body => Number.isFinite(body.position.lengthSq()) && body.velocity.length() < 10)).toBe(true)
  })

  test('bubbles separate from each other and reset clears their stored motion', () => {
    const bubbles = createBubblePhysics(), a = bubbles.bodies[0], b = bubbles.bodies[1]
    b.position.copy(a.position).add(new THREE.Vector3(.1, 0, 0))
    a.velocity.set(2, 0, 0)
    bubbles.beginStep(dt, [], 0)
    bubbles.solveContacts([])
    expect(a.position.distanceTo(b.position)).toBeGreaterThan(a.radius + b.radius)
    expect(b.velocity.x).toBeGreaterThan(0)
    bubbles.reset()
    expect(bubbles.bodies.every(body => body.position.equals(body.home) && body.previous.equals(body.home) && body.velocity.lengthSq() === 0)).toBe(true)
  })
})
