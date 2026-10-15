import { Vector3 } from 'three'
import type { WireBody } from './wirePhysics'

/** The ordinary sculpture and its ascending balloon share reciprocal contacts. */
export function createBodyContacts() {
  const normal = new Vector3()
  return (bodies: readonly WireBody[], ascendingIndex = -1, iterations = 3) => {
    let contacts = 0
    for (let iteration = 0; iteration < iterations; iteration++) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i]
        if (a.enabled === false) continue
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j]
          if (b.enabled === false) continue
          const ascending = i === ascendingIndex || j === ascendingIndex
          // A little extra clearance for the growing surface, including between fixed steps.
          const minimum = ascending ? a.radius + b.radius + .025 : (a.radius + b.radius) * .94
          normal.subVectors(b.position, a.position)
          const distance = normal.length()
          if (distance >= minimum) continue
          if (distance < 1e-6) normal.set(1, 0, 0)
          else normal.multiplyScalar(1 / distance)
          if (ascending) contacts++
          const share = b.mass / (a.mass + b.mass)
          const correction = (minimum - distance) * (ascending ? 1 : .84)
          a.position.addScaledVector(normal, -correction * share)
          b.position.addScaledVector(normal, correction * (1 - share))
          const closing = (b.velocity.x - a.velocity.x) * normal.x + (b.velocity.y - a.velocity.y) * normal.y + (b.velocity.z - a.velocity.z) * normal.z
          if (closing < 0) {
            // A rising balloon yields without rebounding against its lift spring.
            const impulse = -closing * (ascending ? 1 : 1.28)
            a.velocity.addScaledVector(normal, -impulse * share)
            b.velocity.addScaledVector(normal, impulse * (1 - share))
          }
        }
      }
    }
    return contacts
  }
}
