import * as THREE from 'three'

const SLOTS = 4, DROPS = 36, DUST = 54, DURATION = 1.15

/** A fixed pool: polished droplets, soft prismatic dust, and one fading pressure ring. */
export function createBurstEffects(parent: THREE.Group) {
  const group = new THREE.Group()
  parent.add(group)
  const dropletGeometry = new THREE.SphereGeometry(1, 12, 8)
  const dropletMaterial = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .2, metalness: .24, clearcoat: .8, clearcoatRoughness: .16, iridescence: .35, envMapIntensity: 1.25, dithering: true })
  const droplets = new THREE.InstancedMesh(dropletGeometry, dropletMaterial, SLOTS * DROPS)
  droplets.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  droplets.setColorAt(0, new THREE.Color('#ffffff'))
  droplets.frustumCulled = false; droplets.count = 0
  group.add(droplets)
  const positions = new Float32Array(SLOTS * DUST * 3)
  const colors = new Float32Array(positions.length)
  const sizes = new Float32Array(SLOTS * DUST)
  const opacities = new Float32Array(sizes.length)
  const dustGeometry = new THREE.BufferGeometry()
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  dustGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage))
  dustGeometry.setAttribute('particleSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage))
  dustGeometry.setAttribute('particleOpacity', new THREE.BufferAttribute(opacities, 1).setUsage(THREE.DynamicDrawUsage))
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: { pixelsPerUnit: { value: 140 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 color;
      attribute float particleSize;
      attribute float particleOpacity;
      uniform float pixelsPerUnit;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        vColor = color; vOpacity = particleOpacity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, particleSize * pixelsPerUnit);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float glow = exp(-d * d * 5.0) * smoothstep(1.0, 0.6, d);
        gl_FragColor = vec4(vColor, glow * vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const dust = new THREE.Points(dustGeometry, dustMaterial)
  dust.frustumCulled = false
  group.add(dust)
  const ringGeometry = new THREE.RingGeometry(.987, 1, 96)
  const slots = Array.from({ length: SLOTS }, (_, slot) => {
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#f5d7f0', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.visible = false; group.add(ring)
    // Low-discrepancy directions avoid lumpy bursts without random allocations.
    const directions = Array.from({ length: DROPS + DUST }, (_, i) => {
      const angle = i * 2.399963 + slot * .7
      const z = Math.sin(i * 1.73 + slot) * .6
      return new THREE.Vector3(Math.cos(angle), Math.sin(angle), z).normalize()
    })
    return { age: DURATION, center: new THREE.Vector3(), color: new THREE.Color(), radius: 1, ring, ringMaterial, directions }
  })
  const dummy = new THREE.Object3D(), point = new THREE.Vector3(), tint = new THREE.Color(), up = new THREE.Vector3(0, 1, 0)
  const pearl = new THREE.Color('#ffe7f3'), blue = new THREE.Color('#b6d7ff')
  let nextSlot = 0

  const burst = (position: THREE.Vector3, radius: number, color: THREE.Color) => {
    const slot = slots[nextSlot++ % SLOTS]
    slot.age = 0; slot.center.copy(position); slot.radius = radius; slot.color.copy(color).lerp(pearl, .36)
    slot.ring.position.copy(position); slot.ring.position.z += radius * .5
    slot.ringMaterial.color.copy(slot.color).lerp(pearl, .5)
  }
  const update = (dt: number) => {
    let dropCount = 0, dustCount = 0
    for (const slot of slots) {
      slot.age += dt
      const t = slot.age / DURATION
      slot.ring.visible = t < .62
      if (t >= 1) continue
      const energy = 1 - Math.exp(-slot.age * 5.5)
      const fade = (1 - t) ** 1.6
      const extent = Math.max(.55, slot.radius)
      slot.ring.scale.setScalar(slot.radius * (.6 + energy * 1.55))
      slot.ringMaterial.opacity = .32 * Math.max(0, 1 - t / .62) ** 2
      for (let i = 0; i < DROPS; i++) {
        const direction = slot.directions[i]
        const spread = extent * (.35 + energy * (1.25 + (i % 7) * .16))
        dummy.position.copy(slot.center).addScaledVector(direction, spread)
        dummy.position.y -= slot.age * slot.age * .35
        dummy.quaternion.setFromUnitVectors(up, direction)
        const size = extent * (.025 + (i % 5) * .008) * fade
        dummy.scale.set(size, size * (1.3 + (1 - energy) * 2.3), size)
        dummy.updateMatrix(); droplets.setMatrixAt(dropCount, dummy.matrix)
        tint.copy(slot.color).lerp(i % 3 ? pearl : blue, (i % 4) * .18)
        droplets.setColorAt(dropCount++, tint)
      }
      for (let i = 0; i < DUST; i++) {
        const direction = slot.directions[DROPS + i]
        const spread = extent * (.15 + energy * (1.4 + (i % 9) * .16))
        point.copy(slot.center).addScaledVector(direction, spread)
        point.y += slot.age * Math.sin(i) * .16
        point.toArray(positions, dustCount * 3)
        tint.copy(slot.color).lerp(i % 2 ? blue : pearl, .7).toArray(colors, dustCount * 3)
        sizes[dustCount] = extent * (.045 + (i % 5) * .026) * (1 - t * .65)
        opacities[dustCount++] = fade * .8
      }
    }
    droplets.count = dropCount
    droplets.visible = dropCount > 0; dust.visible = dustCount > 0
    if (dropCount) { droplets.instanceMatrix.needsUpdate = true; droplets.instanceColor!.needsUpdate = true }
    if (dustCount) {
      dustGeometry.setDrawRange(0, dustCount)
      for (const attribute of Object.values(dustGeometry.attributes)) attribute.needsUpdate = true
    }
  }
  const reset = () => { slots.forEach(slot => { slot.age = DURATION; slot.ring.visible = false }); droplets.visible = dust.visible = false }
  reset()
  return {
    burst, update, reset,
    resize(pixelsPerUnit: number) { dustMaterial.uniforms.pixelsPerUnit.value = pixelsPerUnit },
    dispose() { parent.remove(group); droplets.dispose(); dropletGeometry.dispose(); dropletMaterial.dispose(); dustGeometry.dispose(); dustMaterial.dispose(); ringGeometry.dispose(); slots.forEach(slot => slot.ringMaterial.dispose()) },
  }
}
