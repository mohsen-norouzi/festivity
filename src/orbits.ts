import * as THREE from 'three'
import { createWirePhysics, WIRE_RADIUS, type WireBody } from './wirePhysics'
import { createBubblePhysics, type BubbleBody, type BubbleInteraction } from './bubblePhysics'
import { createGlassRibbon } from './glassRibbon'

export function createOrbits(parent: THREE.Group, anisotropy = 1) {
  const group = new THREE.Group()
  parent.add(group)
  const wire = createWirePhysics()
  const ribbon = createGlassRibbon(group, anisotropy)
  const bubblePhysics = createBubblePhysics()
  const colliders: WireBody[] = []
  let contactBodies: readonly WireBody[] = []
  let contactSettling = false
  const solveBubbleContacts = () => bubblePhysics.solveContacts(contactBodies, contactSettling)
  const step = (dt: number, cubes: readonly WireBody[], time: number, settling = false, interaction?: BubbleInteraction, integrateBody?: (body: BubbleBody, dt: number) => boolean) => {
    contactBodies = cubes
    contactSettling = settling
    // Reuse the collision list and callback; no per-frame allocations.
    colliders.length = 0
    for (const cube of cubes) if (cube.enabled !== false) colliders.push(cube)
    for (const bubble of bubblePhysics.bodies) if (bubble.enabled !== false) colliders.push(bubble)
    bubblePhysics.beginStep(dt, cubes, time, settling, parent.quaternion, interaction, integrateBody)
    wire.step(dt, colliders, time, settling, solveBubbleContacts)
    ribbon.step(dt, colliders, time, settling, solveBubbleContacts)
  }
  const renderNodes = wire.positions.map(position => position.clone())
  const curve = new THREE.CatmullRomCurve3(renderNodes, true, 'centripetal')
  const segments = wire.positions.length * 2
  const sides = 8
  const centers = Array.from({ length: segments + 1 }, () => new THREE.Vector3())
  const tangents = centers.map(() => new THREE.Vector3())
  const frames = centers.map(() => new THREE.Vector3())
  const positions = new Float32Array((segments + 1) * sides * 3)
  const normals = new Float32Array(positions.length)
  const indices: number[] = []
  for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + (j + 1) % sides
    const c = a + sides, d = b + sides
    indices.push(a, b, c, b, d, c)
  }
  const geometry = new THREE.BufferGeometry()
  const positionAttribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
  const normalAttribute = new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', positionAttribute)
  geometry.setAttribute('normal', normalAttribute)
  geometry.setIndex(indices)
  const material = new THREE.MeshPhysicalMaterial({ color: '#d2bccb', metalness: .75, roughness: .27, envMapIntensity: 1.4, clearcoat: .35, dithering: true })
  const orbit = new THREE.Mesh(geometry, material)
  orbit.frustumCulled = false
  group.add(orbit)
  orbit.visible = false
  let reveal = 0
  const normal = new THREE.Vector3()
  const binormal = new THREE.Vector3()
  const seamNormal = new THREE.Vector3()
  const cross = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  const bubbleGeometry = new THREE.SphereGeometry(1, 32, 24)
  const bubbleMaterial = new THREE.MeshPhysicalMaterial({ color: '#fff0fa', roughness: .065, metalness: 0, transmission: .92, thickness: .3, ior: 1.34, iridescence: .3, iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 410], clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.25, dithering: true })
  const bubbles = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, bubblePhysics.bodies.length)
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  bubbles.frustumCulled = false
  group.add(bubbles)
  const dummy = new THREE.Object3D()
  const update = (alpha = 1, radiusAt?: (index: number) => number) => {
    ribbon.update(alpha)
    renderNodes.forEach((point, i) => point.lerpVectors(wire.previous[i], wire.positions[i], alpha))
    for (let i = 0; i < segments; i++) curve.getPoint(i / segments, centers[i])
    centers[segments].copy(centers[0])
    for (let i = 0; i < segments; i++) tangents[i].subVectors(centers[(i + 1) % segments], centers[(i + segments - 1) % segments]).normalize()
    tangents[segments].copy(tangents[0])
    frames[0].crossVectors(tangents[0], up)
    if (frames[0].lengthSq() < .0001) frames[0].set(1, 0, 0)
    frames[0].normalize()
    // Parallel transport keeps reflections continuous as the wire bends.
    for (let i = 1; i <= segments; i++) {
      frames[i].copy(frames[i - 1]).addScaledVector(tangents[i], -frames[i - 1].dot(tangents[i]))
      if (frames[i].lengthSq() < .0001) frames[i].crossVectors(tangents[i], up)
      frames[i].normalize()
    }
    seamNormal.copy(frames[segments])
    const seamAngle = Math.atan2(tangents[0].dot(cross.crossVectors(seamNormal, frames[0])), seamNormal.dot(frames[0]))
    for (let i = 0; i <= segments; i++) {
      normal.copy(frames[i]).applyAxisAngle(tangents[i], seamAngle * i / segments)
      binormal.crossVectors(tangents[i], normal).normalize()
      for (let j = 0; j < sides; j++) {
        const angle = j / sides * Math.PI * 2
        const nx = normal.x * Math.cos(angle) + binormal.x * Math.sin(angle)
        const ny = normal.y * Math.cos(angle) + binormal.y * Math.sin(angle)
        const nz = normal.z * Math.cos(angle) + binormal.z * Math.sin(angle)
        const offset = (i * sides + j) * 3
        positions[offset] = centers[i].x + nx * WIRE_RADIUS * reveal
        positions[offset + 1] = centers[i].y + ny * WIRE_RADIUS * reveal
        positions[offset + 2] = centers[i].z + nz * WIRE_RADIUS * reveal
        normals[offset] = nx; normals[offset + 1] = ny; normals[offset + 2] = nz
      }
    }
    positionAttribute.needsUpdate = true
    normalAttribute.needsUpdate = true
    bubblePhysics.bodies.forEach((body, i) => {
      dummy.position.lerpVectors(body.previous, body.position, alpha)
      dummy.scale.setScalar(body.enabled === false ? 0 : radiusAt ? radiusAt(i) : body.radius)
      dummy.updateMatrix()
      bubbles.setMatrixAt(i, dummy.matrix)
    })
    bubbles.instanceMatrix.needsUpdate = true
    bubbles.computeBoundingSphere()
  }
  update()
  const reset = () => { wire.reset(); ribbon.reset(); bubblePhysics.reset() }
  const rest = () => { wire.rest(); ribbon.rest(); bubblePhysics.rest() }
  return { wire, ribbon, wireMesh: orbit, reveal(value: number) { reveal = value; orbit.visible = value > 0 }, bubbleMesh: bubbles, bubbleBodies: bubblePhysics.bodies, step, solveContacts: solveBubbleContacts, reset, rest, update, dispose() { ribbon.dispose(); geometry.dispose(); material.dispose(); bubbleGeometry.dispose(); bubbleMaterial.dispose(); bubbles.dispose(); parent.remove(group) } }
}
