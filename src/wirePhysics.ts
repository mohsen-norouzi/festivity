import * as THREE from 'three'

export interface WireBody {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Quaternion
  spin: THREE.Vector3
  halfSize: THREE.Vector3
  shapePower: number
  mass: number
  radius: number
  isSphere?: boolean
}

export const WIRE_RADIUS = .013
const CLEARANCE = WIRE_RADIUS + .035
const NODE_MASS = .022

/** Fixed-step closed cable. Stretch constraints transmit motion around the loop;
 * soft bending and a weak rest-shape spring prevent kinks without fixing its shape.
 */
export function createWirePhysics(count = 96) {
  const homes = Array.from({ length: count }, (_, i) => {
    const t = i / count * Math.PI * 2
    const ripple = 1 + .023 * Math.sin(3 * t + .7) + .012 * Math.cos(5 * t)
    return new THREE.Vector3(4.55 * Math.cos(t) * ripple, .77 * Math.sin(t) + .12 * Math.sin(3 * t + .8), 2.95 * Math.sin(t) * ripple)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), -.17)
  })
  const positions = homes.map(point => point.clone())
  const previous = homes.map(point => point.clone())
  const velocities = homes.map(() => new THREE.Vector3())
  const lengths = homes.map((point, i) => point.distanceTo(homes[(i + 1) % count]))
  const bendLengths = homes.map((point, i) => point.distanceTo(homes[(i + 2) % count]))
  const delta = new THREE.Vector3()
  const local = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const torque = new THREE.Vector3()
  const lever = new THREE.Vector3()
  const midpoint = new THREE.Vector3()
  const segment = new THREE.Vector3()
  const inverse = new THREE.Quaternion()
  const inverses: THREE.Quaternion[] = []
  const candidates = Array.from({ length: count }, () => [] as number[])
  let contacts = 0

  const constrain = (i: number, j: number, rest: number, stiffness: number) => {
    delta.subVectors(positions[j], positions[i])
    const length = delta.length()
    if (length < 1e-7) return
    const correction = (length - rest) / length * .5 * stiffness
    positions[i].addScaledVector(delta, correction)
    positions[j].addScaledVector(delta, -correction)
  }

  const collide = (point: THREE.Vector3, first: number, second: number, bodies: readonly WireBody[], dt: number, settling: boolean) => {
    const nearby = candidates[first]
    for (let candidate = 0; candidate < nearby.length; candidate++) {
      const index = nearby[candidate]
      const body = bodies[index]
      // Sphere contacts use the closest point on the entire cable segment below.
      if (body.isSphere) continue
      delta.subVectors(point, body.position)
      if (delta.lengthSq() > (body.radius + CLEARANCE * 2) ** 2) continue
      local.copy(delta).applyQuaternion(inverses[index])
      const ax = body.halfSize.x + CLEARANCE, ay = body.halfSize.y + CLEARANCE, az = body.halfSize.z + CLEARANCE
      if (Math.abs(local.x) > ax || Math.abs(local.y) > ay || Math.abs(local.z) > az) continue
      const power = body.shapePower
      const x = Math.abs(local.x) / ax, y = Math.abs(local.y) / ay, z = Math.abs(local.z) / az
      const level = Math.pow(x ** power + y ** power + z ** power, 1 / power)
      if (level >= 1) continue
      let depth: number
      if (level < .00001) {
        // Deterministic nearest-face escape if a fast drag lands on the center.
        if (ax <= ay && ax <= az) { normal.set(1, 0, 0); depth = ax }
        else if (ay <= az) { normal.set(0, 1, 0); depth = ay }
        else { normal.set(0, 0, 1); depth = az }
      } else {
        const factor = level ** (1 - power)
        normal.set(Math.sign(local.x) * x ** (power - 1) / ax, Math.sign(local.y) * y ** (power - 1) / ay, Math.sign(local.z) * z ** (power - 1) / az).multiplyScalar(factor)
        const gradientLength = normal.length()
        depth = (1 - level) / gradientLength
        normal.multiplyScalar(1 / gradientLength)
      }
      normal.applyQuaternion(body.rotation)
      const mass = second < 0 ? NODE_MASS : NODE_MASS * 2
      const bodyShare = Math.min(.28, mass / (body.mass + mass))
      const wireDistance = depth * (1 - bodyShare)
      positions[first].addScaledVector(normal, wireDistance)
      if (second >= 0) {
        positions[second].addScaledVector(normal, wireDistance)
        point.addScaledVector(normal, wireDistance)
      }
      body.position.addScaledVector(normal, -depth * bodyShare)
      if (!settling) {
        const reaction = Math.min(.55, depth * bodyShare / dt * .45)
        body.velocity.addScaledVector(normal, -reaction)
        lever.subVectors(point, body.position)
        torque.crossVectors(lever, normal)
        body.spin.addScaledVector(torque, -reaction * .22 / Math.max(.1, body.radius ** 2))
      }
      contacts++
    }
  }

  const collideSpheres = (first: number, second: number, bodies: readonly WireBody[], dt: number, settling: boolean) => {
    for (const index of candidates[first]) {
      const body = bodies[index]
      if (!body.isSphere) continue
      segment.subVectors(positions[second], positions[first])
      const lengthSq = segment.lengthSq()
      const t = lengthSq > 1e-10 ? THREE.MathUtils.clamp(delta.subVectors(body.position, positions[first]).dot(segment) / lengthSq, 0, 1) : 0
      midpoint.copy(positions[first]).addScaledVector(segment, t)
      normal.subVectors(midpoint, body.position)
      const distance = normal.length(), minimum = body.radius + CLEARANCE
      if (distance >= minimum) continue
      if (distance < 1e-6) {
        normal.set(-segment.y, segment.x, 0)
        if (normal.lengthSq() < 1e-10) normal.set(1, 0, 0)
        normal.normalize()
      } else normal.multiplyScalar(1 / distance)
      const firstWeight = 1 - t, secondWeight = t
      const wireInverseMass = (firstWeight ** 2 + secondWeight ** 2) / NODE_MASS
      const bubbleInverseMass = 1 / body.mass
      const correction = (minimum - distance) / (wireInverseMass + bubbleInverseMass)
      positions[first].addScaledVector(normal, correction * firstWeight / NODE_MASS)
      positions[second].addScaledVector(normal, correction * secondWeight / NODE_MASS)
      body.position.addScaledVector(normal, -correction * bubbleInverseMass)
      if (!settling) {
        delta.copy(velocities[first]).multiplyScalar(firstWeight).addScaledVector(velocities[second], secondWeight).sub(body.velocity)
        const closing = delta.dot(normal)
        if (closing < 0) {
          const impulse = -closing * 1.08 / (wireInverseMass + bubbleInverseMass)
          velocities[first].addScaledVector(normal, impulse * firstWeight / NODE_MASS)
          velocities[second].addScaledVector(normal, impulse * secondWeight / NODE_MASS)
          body.velocity.addScaledVector(normal, -impulse * bubbleInverseMass)
        }
        // Transfer some positional contact motion, including a slowly stretching cable.
        body.velocity.addScaledVector(normal, -Math.min(.3, correction * bubbleInverseMass / dt * .12))
      }
      contacts++
    }
  }

  const step = (dt: number, bodies: readonly WireBody[], time: number, settling = false, resolveBodies?: () => void) => {
    contacts = 0
    bodies.forEach((body, i) => {
      if (!inverses[i]) inverses[i] = new THREE.Quaternion()
      inverses[i].copy(inverse.copy(body.rotation).invert())
    })
    const damping = Math.exp(-(settling ? 4 : 1.7) * dt)
    for (let i = 0; i < count; i++) {
      previous[i].copy(positions[i])
      const phase = i / count * Math.PI * 2
      delta.subVectors(homes[i], positions[i]).multiplyScalar(.8)
      // A small traveling load excites the cable; it does not replace the simulation.
      if (!settling) {
        delta.y += Math.sin(phase * 3 - time * 1.25) * .2
        delta.z += Math.sin(phase * 4 + time * .85) * .1
      }
      velocities[i].addScaledVector(delta, dt).multiplyScalar(damping).clampLength(0, 12)
      positions[i].addScaledVector(velocities[i], dt)
    }
    const refreshCandidates = () => {
      for (let i = 0; i < count; i++) {
        const point = positions[i], nearby = candidates[i]
        nearby.length = 0
        for (let j = 0; j < bodies.length; j++) {
          const body = bodies[j]
          const x = point.x - body.position.x, y = point.y - body.position.y, z = point.z - body.position.z
          // Padding covers all motion during the constraint passes, including midpoints.
          if (x * x + y * y + z * z < (body.radius + 1) ** 2) nearby.push(j)
        }
      }
    }
    for (let iteration = 0; iteration < 6; iteration++) {
      resolveBodies?.()
      if (iteration === 0 || iteration === 3) refreshCandidates()
      // Alternate traversal avoids accumulating a twist in one direction.
      for (let n = 0; n < count; n++) {
        const i = iteration % 2 ? count - 1 - n : n
        constrain(i, (i + 1) % count, lengths[i], .94)
        constrain(i, (i + 2) % count, bendLengths[i], .065)
      }
      for (let i = 0; i < count; i++) collide(positions[i], i, -1, bodies, dt, settling)
      for (let i = 0; i < count; i++) collideSpheres(i, (i + 1) % count, bodies, dt, settling)
      if (iteration === 5) {
        // Segment contacts prevent a thin cable from cutting corners between nodes.
        for (let i = 0; i < count; i++) {
          const j = (i + 1) % count
          midpoint.addVectors(positions[i], positions[j]).multiplyScalar(.5)
          collide(midpoint, i, j, bodies, dt, settling)
        }
        for (let i = 0; i < count; i++) collide(positions[i], i, -1, bodies, dt, settling)
      }
    }
    // Alternate the two contact sets so a bubble caught between a cube and the
    // cable cannot be pushed into the other collider by the last solver pass.
    if (resolveBodies) {
      for (let pass = 0; pass < 3; pass++) {
        resolveBodies()
        for (let i = 0; i < count; i++) collideSpheres(i, (i + 1) % count, bodies, dt, settling)
      }
      resolveBodies()
    }
    for (let i = 0; i < count; i++) velocities[i].subVectors(positions[i], previous[i]).multiplyScalar(1 / dt).clampLength(0, 12)
  }

  const reset = () => {
    positions.forEach((point, i) => { point.copy(homes[i]); previous[i].copy(point); velocities[i].set(0, 0, 0) })
    contacts = 0
  }
  const rest = () => positions.forEach((point, i) => { previous[i].copy(point); velocities[i].set(0, 0, 0) })
  return { positions, previous, velocities, homes, lengths, step, reset, rest, get contacts() { return contacts } }
}
