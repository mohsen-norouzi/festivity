import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createRibbonGeometry, createRibbonPhysics, RIBBON_HALF_WIDTH } from '../src/glassRibbon'
import type { WireBody } from '../src/wirePhysics'

const dt = 1 / 90

describe('glass ribbon', () => {
  test('the entire width clears a rotating cube dragged across its orbit', () => {
    const physics = createRibbonPhysics()
    const start = physics.positions[10].clone()
    const body: WireBody = { position: start.clone(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.65, .58, .52), shapePower: 3.8, radius: 1, mass: .85 }
    const geometry = createRibbonGeometry(physics.positions)
    const point = new THREE.Vector3(), inverse = new THREE.Quaternion()
    let minimum = Infinity
    for (let step = 0; step < 150; step++) {
      body.position.copy(start).add(new THREE.Vector3(-step * .002, Math.sin(step * .025) * .2, 0))
      body.rotation.setFromEuler(new THREE.Euler(.2, .3 + step * .003, -.2))
      physics.step(dt, [body], step * dt)
      if (step < 15) continue
      geometry.update()
      inverse.copy(body.rotation).invert()
      const vertices = geometry.glass.getAttribute('position')
      for (let i = 0; i < vertices.count; i++) {
        point.fromBufferAttribute(vertices, i).sub(body.position).applyQuaternion(inverse)
        const level = (Math.abs(point.x / body.halfSize.x) ** body.shapePower + Math.abs(point.y / body.halfSize.y) ** body.shapePower + Math.abs(point.z / body.halfSize.z) ** body.shapePower) ** (1 / body.shapePower)
        minimum = Math.min(minimum, level)
      }
    }
    expect(minimum).toBeGreaterThan(.995)
    geometry.dispose()
  })

  test('glass spheres exchange motion with the full band, not just its centerline', () => {
    const physics = createRibbonPhysics()
    const start = physics.positions[20].clone()
    const body: WireBody = { position: start.clone().add(new THREE.Vector3(0, RIBBON_HALF_WIDTH, 0)), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.2,.2,.2), shapePower: 2, radius: .2, mass: .045, isSphere: true }
    const original = body.position.clone()
    physics.step(dt, [body], 0)
    expect(physics.contacts).toBeGreaterThan(0)
    expect(body.position.distanceTo(original)).toBeGreaterThan(.01)
    expect(physics.positions[20].distanceTo(start)).toBeGreaterThan(.01)
  })

  test('the closed bevel is watertight and normals remain smooth after deformation', () => {
    const physics = createRibbonPhysics()
    const geometry = createRibbonGeometry(physics.positions)
    physics.velocities[14].set(0, 2, .5)
    for (let i = 0; i < 900; i++) physics.step(dt, [], i * dt)
    geometry.update()
    const position = geometry.glass.getAttribute('position'), normal = geometry.glass.getAttribute('normal')
    const point = new THREE.Vector3(), end = new THREE.Vector3()
    for (let i = 0; i < 18; i++) expect(point.fromBufferAttribute(position, i).distanceTo(end.fromBufferAttribute(position, position.count - 18 + i))).toBeLessThan(1e-6)
    for (let i = 0; i < normal.count; i++) expect(point.fromBufferAttribute(normal, i).length()).toBeCloseTo(1, 5)
    expect(position.array.every(Number.isFinite)).toBe(true)
    const stretch = physics.positions.map((p, i) => p.distanceTo(physics.positions[(i + 1) % physics.positions.length]) / physics.lengths[i])
    expect(Math.max(...stretch)).toBeLessThan(1.06)
    geometry.dispose()
  })
})
