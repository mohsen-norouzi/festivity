import * as THREE from 'three'
import type { WireBody } from './wirePhysics'

export interface BubbleBody extends WireBody {
  home: THREE.Vector3
  previous: THREE.Vector3
}

export interface BubbleInteraction {
  hover: boolean
  dragging: number
  pointer: THREE.Vector3
  dragTarget: THREE.Vector3
  velocity: THREE.Vector3
}

const SKIN = .018

/** Light sphere bodies, kept in the same local coordinates as the cubes and cable. */
export function createBubblePhysics() {
  const sizes = [.23, .2, .27, .14, .115]
  const locations = [[-3.65, 1.2, 1.4], [3.45, 1.2, 1.7], [-4.05, -1.15, 1.3], [2.4, 2.8, -.8], [.15, -2.65, 2.3]]
  const axis = new THREE.Vector3(0, 0, 1)
  const bodies: BubbleBody[] = locations.map((location, i) => {
    const home = new THREE.Vector3(location[0], location[1], location[2]).applyAxisAngle(axis, -.17)
    const radius = sizes[i]
    return {
      home, position: home.clone(), previous: home.clone(), velocity: new THREE.Vector3(),
      rotation: new THREE.Quaternion(), spin: new THREE.Vector3(), halfSize: new THREE.Vector3(radius, radius, radius),
      shapePower: 2, isSphere: true, radius, mass: Math.max(.008, radius ** 3),
    }
  })
  const delta = new THREE.Vector3()
  const local = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const lever = new THREE.Vector3()
  const surfaceVelocity = new THREE.Vector3()
  const torque = new THREE.Vector3()
  const inverses: THREE.Quaternion[] = []
  const viewInverse = new THREE.Quaternion()
  const viewX = new THREE.Vector3(1, 0, 0)
  const viewY = new THREE.Vector3(0, 1, 0)
  const viewNormals = Array.from({ length: 32 }, () => new THREE.Vector3())
  const silhouetteSupports: Float64Array[] = []
  let protectSilhouettes = false

  const beginStep = (dt: number, cubes: readonly WireBody[], time: number, settling = false, viewRotation?: THREE.Quaternion, interaction?: BubbleInteraction) => {
    protectSilhouettes = viewRotation !== undefined
    if (viewRotation) {
      viewInverse.copy(viewRotation).invert()
      viewX.set(1, 0, 0).applyQuaternion(viewInverse)
      viewY.set(0, 1, 0).applyQuaternion(viewInverse)
      viewNormals.forEach((direction, i) => direction.copy(viewX).multiplyScalar(Math.cos(i * Math.PI * 2 / viewNormals.length)).addScaledVector(viewY, Math.sin(i * Math.PI * 2 / viewNormals.length)))
    }
    cubes.forEach((cube, i) => {
      if (!inverses[i]) inverses[i] = new THREE.Quaternion()
      inverses[i].copy(cube.rotation).invert()
      if (protectSilhouettes) {
        if (!silhouetteSupports[i]) silhouetteSupports[i] = new Float64Array(viewNormals.length)
        const power = cube.shapePower / (cube.shapePower - 1)
        // Support of a rotated superellipsoid, projected into the camera plane.
        // Cache the curved outline once per step, not on every solver iteration.
        viewNormals.forEach((direction, j) => {
          local.copy(direction).applyQuaternion(inverses[i])
          silhouetteSupports[i][j] = (Math.abs(local.x * cube.halfSize.x) ** power + Math.abs(local.y * cube.halfSize.y) ** power + Math.abs(local.z * cube.halfSize.z) ** power) ** (1 / power)
        })
      }
    })
    bodies.forEach((body, i) => {
      body.previous.copy(body.position)
      delta.copy(body.home).sub(body.position).multiplyScalar(1.6)
      if (!settling) {
        delta.y += Math.sin(time * .4 + i * 1.6) * .18
        delta.x += Math.sin(time * .27 + i) * .045
      }
      body.velocity.addScaledVector(delta, dt)
      if (!settling && interaction) {
        if (interaction.dragging === i) {
          delta.subVectors(interaction.dragTarget, body.position)
          body.velocity.addScaledVector(delta, 70 * dt).multiplyScalar(Math.exp(-7 * dt))
        } else if (interaction.hover) {
          delta.subVectors(body.position, interaction.pointer)
          // Hover is a screen gesture, including for the small rear glass spheres.
          const x = delta.dot(viewX), y = delta.dot(viewY)
          delta.copy(viewX).multiplyScalar(x).addScaledVector(viewY, y)
          const distance = delta.length(), reach = body.radius + .48
          if (distance > .001 && distance < reach) {
            body.velocity.addScaledVector(delta, (1 - distance / reach) * 28 * dt / distance)
            body.velocity.addScaledVector(interaction.velocity, dt * .85)
          }
        }
      }
      body.velocity.multiplyScalar(Math.exp(-(settling ? 4 : 1.8) * dt)).clampLength(0, 8)
      body.position.addScaledVector(body.velocity, dt)
    })
  }

  const separate = (bubble: BubbleBody, other: WireBody, depth: number, settling: boolean) => {
    const bubbleShare = other.mass / (bubble.mass + other.mass)
    bubble.position.addScaledVector(normal, depth * bubbleShare)
    other.position.addScaledVector(normal, -depth * (1 - bubbleShare))
    if (settling) return
    // Include the cube's surface speed: a turning corner can nudge a bubble too.
    lever.copy(bubble.position).addScaledVector(normal, -bubble.radius).sub(other.position)
    lever.clampLength(0, other.radius)
    surfaceVelocity.crossVectors(other.spin, lever).add(other.velocity)
    const closing = delta.subVectors(bubble.velocity, surfaceVelocity).dot(normal)
    if (closing >= 0) return
    const impulse = -closing * 1.12
    bubble.velocity.addScaledVector(normal, impulse * bubbleShare)
    other.velocity.addScaledVector(normal, -impulse * (1 - bubbleShare))
    if (!other.isSphere) {
      torque.crossVectors(lever, normal)
      other.spin.addScaledVector(torque, -impulse * (1 - bubbleShare) * .25 / Math.max(.1, other.radius ** 2))
    }
  }

  const solveContacts = (cubes: readonly WireBody[], settling = false) => {
    for (const bubble of bodies) {
      for (let index = 0; index < cubes.length; index++) {
        const cube = cubes[index]
        delta.subVectors(bubble.position, cube.position)
        if (protectSilhouettes) {
          const x = delta.dot(viewX), y = delta.dot(viewY)
          if (x * x + y * y > (cube.radius + bubble.radius + SKIN) ** 2) continue
          let maximumGap = -Infinity, nearestPlane = 0
          for (let plane = 0; plane < viewNormals.length; plane++) {
            const gap = delta.dot(viewNormals[plane]) - silhouetteSupports[index][plane]
            if (gap > maximumGap) { maximumGap = gap; nearestPlane = plane }
          }
          const padding = bubble.radius + SKIN
          if (maximumGap < padding) {
            normal.copy(viewNormals[nearestPlane])
            separate(bubble, cube, padding - maximumGap, settling)
          }
          continue
        }
        if (delta.lengthSq() > (cube.radius + bubble.radius + SKIN) ** 2) continue
        local.copy(delta).applyQuaternion(inverses[index])
        const { x: ax, y: ay, z: az } = cube.halfSize
        const padding = bubble.radius + SKIN
        if (Math.abs(local.x) > ax + padding || Math.abs(local.y) > ay + padding || Math.abs(local.z) > az + padding) continue
        const power = cube.shapePower
        const x = Math.abs(local.x) / ax, y = Math.abs(local.y) / ay, z = Math.abs(local.z) / az
        const level = (x ** power + y ** power + z ** power) ** (1 / power)
        let distance: number
        if (level < 1e-6) {
          if (ax <= ay && ax <= az) { normal.set(1, 0, 0); distance = -ax }
          else if (ay <= az) { normal.set(0, 1, 0); distance = -ay }
          else { normal.set(0, 0, 1); distance = -az }
        } else {
          // A support plane of the actual rounded cube, offset by the sphere radius.
          // Expanding cube dimensions alone underestimates clearance at corners.
          normal.set(Math.sign(local.x) * x ** (power - 1) / ax, Math.sign(local.y) * y ** (power - 1) / ay, Math.sign(local.z) * z ** (power - 1) / az)
            .multiplyScalar(level ** (1 - power))
          const gradientLength = normal.length()
          distance = (level - 1) / gradientLength
          normal.multiplyScalar(1 / gradientLength)
        }
        if (distance >= padding) continue
        normal.applyQuaternion(cube.rotation)
        separate(bubble, cube, padding - distance, settling)
      }
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j]
      normal.subVectors(a.position, b.position)
      const distance = normal.length(), minimum = a.radius + b.radius + SKIN
      if (distance >= minimum) continue
      if (distance < 1e-6) normal.set(1, 0, 0)
      else normal.multiplyScalar(1 / distance)
      separate(a, b, minimum - distance, settling)
    }
  }

  const rest = () => bodies.forEach(body => { body.previous.copy(body.position); body.velocity.set(0, 0, 0) })
  const reset = () => { bodies.forEach(body => body.position.copy(body.home)); rest() }
  return { bodies, beginStep, solveContacts, reset, rest }
}
