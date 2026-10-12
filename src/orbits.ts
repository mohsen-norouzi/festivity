import * as THREE from 'three'

export function createOrbits(parent: THREE.Group) {
  const group = new THREE.Group()
  parent.add(group)
  class Orbit extends THREE.Curve<THREE.Vector3> {
    constructor() { super() }
    getPoint(t: number, target = new THREE.Vector3()) {
      const angle = t * Math.PI * 2
      return target.set(4.55 * Math.cos(angle), .77 * Math.sin(angle), 2.95 * Math.sin(angle))
    }
  }
  const path = new Orbit()
  const geometry = new THREE.TubeGeometry(path, 192, .009, 6, true)
  const material = new THREE.MeshPhysicalMaterial({ color: '#e1d5f6', metalness: .75, roughness: .2, envMapIntensity: 1.8, clearcoat: .5, dithering: true })
  const orbit = new THREE.Mesh(geometry, material)
  group.add(orbit)
  const bubbleGeometry = new THREE.SphereGeometry(1, 32, 24)
  const bubbleMaterial = new THREE.MeshPhysicalMaterial({ color: '#f7efff', roughness: .065, metalness: 0, transmission: .92, thickness: .3, ior: 1.34, iridescence: .8, iridescenceIOR: 1.3, iridescenceThicknessRange: [100, 410], clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.8, dithering: true })
  const bubbles = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, 5)
  group.add(bubbles)
  const dummy = new THREE.Object3D()
  const positions = [new THREE.Vector3(-3.65, 1.2, 1.4), new THREE.Vector3(3.45, 1.2, 1.7), new THREE.Vector3(-4.05, -1.15, 1.3), new THREE.Vector3(2.4, 2.8, -.8), new THREE.Vector3(.15, -2.65, 2.3)]
  const sizes = [.23, .2, .27, .14, .115]
  const update = (time: number) => {
    group.rotation.z = -.17 + Math.sin(time * .15) * .025
    positions.forEach((position, i) => {
      dummy.position.copy(position)
      dummy.position.y += Math.sin(time * .4 + i * 1.6) * .1
      dummy.scale.setScalar(sizes[i])
      dummy.updateMatrix()
      bubbles.setMatrixAt(i, dummy.matrix)
    })
    bubbles.instanceMatrix.needsUpdate = true
  }
  update(0)
  return { update, dispose() { geometry.dispose(); material.dispose(); bubbleGeometry.dispose(); bubbleMaterial.dispose(); bubbles.dispose(); parent.remove(group) } }
}
