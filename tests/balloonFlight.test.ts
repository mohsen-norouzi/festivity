import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createBalloonFlight } from '../src/balloonFlight'
import { createBalloonJourney, JOURNEY_ARRIVAL } from '../src/balloonJourney'
import { createBurstLifecycle, type BurstBody } from '../src/burstLifecycle'
import { createBodyContacts } from '../src/bodyContacts'
import { createOrbits } from '../src/orbits'

const dt = 1 / 90
const cubeAt = (x: number, y: number, z = 0): BurstBody => {
  const position = new THREE.Vector3(x, y, z)
  return { position, previous: position.clone(), home: position.clone(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(), spin: new THREE.Vector3(), halfSize: new THREE.Vector3(.64, .64, .55), shapePower: 3.8, mass: 1, radius: 1, enabled: true }
}

describe('live balloon ascent', () => {
  test('a growing tile pushes a neighbor, yields to contact, and still rises at arrival', () => {
    const balloon = cubeAt(-.15, -2.1), neighbor = cubeAt(.15, .05)
    const bodies = [balloon, neighbor], flight = createBalloonFlight(), journey = createBalloonJourney(), solve = createBodyContacts()
    let scale = 1, contacts = 0, minimumGap = Infinity, largestDeflection = 0
    const lifecycle = createBurstLifecycle(bodies, () => {}, () => {}, () => 1, i => i === 0 ? scale : null)
    const target = balloon.position.clone(), start = balloon.position.clone()
    journey.start(0); flight.start(balloon)
    for (let frame = 0; frame < Math.ceil(JOURNEY_ARRIVAL / dt); frame++) {
      journey.step(dt)
      scale = 1 + journey.state.growth
      lifecycle.step(dt)
      target.set(0, THREE.MathUtils.lerp(start.y, 8.2, journey.state.rise), 0)
      flight.aim(target, dt); flight.integrate(balloon, dt)
      neighbor.previous.copy(neighbor.position)
      neighbor.velocity.addScaledVector(neighbor.home.clone().sub(neighbor.position), 3.8 * dt).multiplyScalar(Math.exp(-1.75 * dt))
      neighbor.position.addScaledVector(neighbor.velocity, dt)
      contacts += solve(bodies, 0, 6)
      largestDeflection = Math.max(largestDeflection, Math.abs(balloon.position.x))
      minimumGap = Math.min(minimumGap, balloon.position.distanceTo(neighbor.position) - balloon.radius - neighbor.radius)
      expect(lifecycle.scale(0)).toBeCloseTo(balloon.radius, 10)
      expect(balloon.enabled).toBe(true)
    }
    expect(contacts).toBeGreaterThan(10)
    expect(minimumGap).toBeGreaterThanOrEqual(.024)
    expect(largestDeflection).toBeGreaterThan(.17)
    expect(neighbor.position.distanceTo(neighbor.home)).toBeGreaterThan(.2)
    expect(balloon.position.y).toBeGreaterThan(7.8)
    expect(balloon.velocity.y).toBeGreaterThan(2)
  })

  test('the actual glass instance rises with live cube, bubble, wire and ribbon contacts', () => {
    const parent = new THREE.Group(), orbits = createOrbits(parent)
    const balloon = orbits.bubbleBodies[0]
    balloon.position.copy(orbits.wire.positions[6]).add(new THREE.Vector3(0, -.9, 0))
    balloon.home.copy(balloon.position); balloon.previous.copy(balloon.position)
    const start = balloon.position.clone(), cube = cubeAt(start.x + .12, start.y + 1.5, start.z)
    const cubeStart = cube.position.clone(), wireStart = orbits.wire.positions.map(p => p.clone())
    const flight = createBalloonFlight(), journey = createBalloonJourney(), target = start.clone()
    let scale = 1, contactFrames = 0, maxCubeDisplacement = 0, minimumGap = Infinity
    const lifecycle = createBurstLifecycle([balloon], () => {}, () => {}, () => 1, () => scale)
    journey.start(0); flight.start(balloon)
    for (let frame = 0; frame < 334; frame++) {
      journey.step(dt); scale = 1 + journey.state.growth * 6
      lifecycle.step(dt)
      target.set(start.x, THREE.MathUtils.lerp(start.y, 10, journey.state.rise), start.z)
      flight.aim(target, dt)
      cube.previous.copy(cube.position)
      cube.velocity.addScaledVector(cube.home.clone().sub(cube.position), 3.8 * dt).multiplyScalar(Math.exp(-1.75 * dt))
      cube.position.addScaledVector(cube.velocity, dt)
      orbits.step(dt, [cube], frame * dt, false, undefined, flight.integrate)
      orbits.solveContacts()
      if (orbits.wire.contacts + orbits.ribbon.physics.contacts > 0) contactFrames++
      maxCubeDisplacement = Math.max(maxCubeDisplacement, cube.position.distanceTo(cubeStart))
      // The cube is unrotated: its supporting face must stay outside the sphere.
      const gap = Math.max(Math.abs(balloon.position.x - cube.position.x) - cube.halfSize.x, Math.abs(balloon.position.y - cube.position.y) - cube.halfSize.y)
      minimumGap = Math.min(minimumGap, gap - balloon.radius)
    }
    orbits.update(1, i => i === 0 ? lifecycle.scale(0) : orbits.bubbleBodies[i].radius)
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), radius = new THREE.Vector3()
    orbits.bubbleMesh.getMatrixAt(0, matrix); position.setFromMatrixPosition(matrix); radius.setFromMatrixScale(matrix)
    expect(position.distanceTo(balloon.position)).toBeLessThan(.00001)
    expect(radius.x).toBeCloseTo(balloon.radius, 5)
    expect(Math.abs(balloon.position.y - 10)).toBeLessThan(balloon.radius / 2)
    expect(balloon.velocity.y).toBeGreaterThan(2)
    expect(contactFrames).toBeGreaterThan(0)
    expect(maxCubeDisplacement).toBeGreaterThan(.01)
    expect(minimumGap).toBeGreaterThan(-.06)
    expect(orbits.wire.positions.some((p, i) => p.distanceTo(wireStart[i]) > .01)).toBe(true)
    orbits.dispose()
  })


  test('a contact displacement settles without oscillation', () => {
    const body = cubeAt(0, 0), flight = createBalloonFlight(), target = new THREE.Vector3()
    flight.start(body)
    // A neighboring surface pushes the balloon sideways; lift must settle without ringing.
    body.position.x = .4
    let previousError = .4
    for (let i = 0; i < 270; i++) {
      flight.aim(target, dt); flight.integrate(body, dt)
      expect(body.position.x).toBeGreaterThanOrEqual(0)
      expect(body.position.x).toBeLessThanOrEqual(previousError)
      previousError = body.position.x
    }
    expect(body.position.x).toBeLessThan(.0001)
  })

  test('cancelling a flight immediately releases its force without teleporting the body', () => {
    const body = cubeAt(0, 0), flight = createBalloonFlight()
    flight.start(body); flight.aim(new THREE.Vector3(0, 2, 0), dt); flight.integrate(body, dt)
    const position = body.position.clone(), velocity = body.velocity.clone()
    flight.reset()
    expect(flight.integrate(body, dt)).toBe(false)
    expect(body.position.equals(position)).toBe(true)
    expect(body.velocity.equals(velocity)).toBe(true)
  })
})
