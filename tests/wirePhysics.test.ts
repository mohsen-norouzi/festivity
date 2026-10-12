import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createWirePhysics, WIRE_RADIUS, type WireBody } from '../src/wirePhysics'

const dt = 1 / 90
const bodyAt = (position: THREE.Vector3): WireBody => ({
  position: position.clone(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(.23, .31, -.2)),
  spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.65, .58, .52), shapePower: 3.8, mass: .85, radius: 1,
})
const level = (point: THREE.Vector3, body: WireBody) => {
  const q = point.clone().sub(body.position).applyQuaternion(body.rotation.clone().invert())
  return (Math.abs(q.x / (body.halfSize.x + WIRE_RADIUS)) ** body.shapePower + Math.abs(q.y / (body.halfSize.y + WIRE_RADIUS)) ** body.shapePower + Math.abs(q.z / (body.halfSize.z + WIRE_RADIUS)) ** body.shapePower) ** (1 / body.shapePower)
}

describe('flexible closed wire', () => {
  test('remains finite and resists stretching through twenty seconds of motion', () => {
    const wire = createWirePhysics()
    for (let i = 0; i < 1800; i++) wire.step(dt, [], i * dt)
    expect(wire.positions.every(point => Number.isFinite(point.lengthSq()))).toBe(true)
    const stretch = wire.positions.map((point, i) => point.distanceTo(wire.positions[(i + 1) % wire.positions.length]) / wire.lengths[i])
    expect(Math.max(...stretch)).toBeLessThan(1.06)
    expect(Math.min(...stretch)).toBeGreaterThan(.94)
  })

  test('both the cable and a rotated cube react to contact', () => {
    const wire = createWirePhysics()
    const body = bodyAt(wire.positions[8])
    const startBody = body.position.clone()
    const startNode = wire.positions[8].clone()
    wire.step(dt, [body], 0)
    expect(wire.contacts).toBeGreaterThan(0)
    expect(body.position.distanceTo(startBody)).toBeGreaterThan(.001)
    expect(body.velocity.length()).toBeGreaterThan(.01)
    expect(wire.positions[8].distanceTo(startNode)).toBeGreaterThan(.05)
  })

  test('rendered segments stay outside the rounded cube during a slow drag', () => {
    const wire = createWirePhysics()
    const home = wire.positions[4].clone()
    const body = bodyAt(home)
    let minimum = Infinity
    const sample = new THREE.Vector3()
    for (let step = 0; step < 180; step++) {
      body.position.copy(home).add(new THREE.Vector3(-step * .002, Math.sin(step * .02) * .25, 0))
      body.velocity.set(-.18, Math.cos(step * .02) * .45, 0)
      wire.step(dt, [body], step * dt)
      if (step < 15) continue
      const curve = new THREE.CatmullRomCurve3(wire.positions, true, 'centripetal')
      for (let i = 0; i < 512; i++) minimum = Math.min(minimum, level(curve.getPoint(i / 512, sample), body))
    }
    expect(minimum).toBeGreaterThan(.995)
  })

  test('a localized disturbance propagates to nearby nodes and damps away', () => {
    const wire = createWirePhysics(), control = createWirePhysics()
    wire.velocities[8].y = 3
    let neighborMovement = 0, peakDifference = 0
    for (let i = 0; i < 900; i++) {
      wire.step(dt, [], i * dt); control.step(dt, [], i * dt)
      if (i < 120) neighborMovement = Math.max(neighborMovement, wire.positions[11].distanceTo(control.positions[11]))
      peakDifference = Math.max(peakDifference, wire.positions[8].distanceTo(control.positions[8]))
    }
    expect(neighborMovement).toBeGreaterThan(.003)
    expect(wire.positions[8].distanceTo(control.positions[8])).toBeLessThan(peakDifference * .2)
  })

  test('reset restores a deterministic loop and removes its stored motion', () => {
    const wire = createWirePhysics()
    const initial = wire.positions.map(point => point.clone())
    wire.velocities[4].set(2, -1, 3)
    for (let i = 0; i < 100; i++) wire.step(dt, [], i * dt)
    wire.reset()
    expect(wire.positions.every((point, i) => point.equals(initial[i]))).toBe(true)
    expect(wire.previous.every((point, i) => point.equals(initial[i]))).toBe(true)
    expect(wire.velocities.every(velocity => velocity.lengthSq() === 0)).toBe(true)
  })
})
