import * as THREE from 'three'
import { createBurstDynamics, BURST_SLOTS, FRAGMENTS_PER_BURST, MOTES_PER_BURST, type BurstSource } from './burstDynamics'
import type { WireBody } from './wirePhysics'

function fragmentGeometry() {
  const geometry = new THREE.BoxGeometry(2, 2, 2, 4, 4, 4)
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal')
  const normal = new THREE.Vector3(), power = 3.2
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const scale = (Math.abs(x) ** power + Math.abs(y) ** power + Math.abs(z) ** power) ** (-1 / power)
    positions.setXYZ(i, x * scale, y * scale, z * scale)
    normal.set(Math.sign(x) * Math.abs(x) ** (power - 1), Math.sign(y) * Math.abs(y) ** (power - 1), Math.sign(z) * Math.abs(z) ** (power - 1)).normalize()
    normals.setXYZ(i, normal.x, normal.y, normal.z)
  }
  return geometry
}

/** Reusable material batches keep real ceramic, satin, and glass finishes in the debris. */
export function createBurstEffects(parent: THREE.Group, finishes: Record<string, THREE.MeshPhysicalMaterial>) {
  const group = new THREE.Group()
  parent.add(group)
  const dynamics = createBurstDynamics()
  const cubeGeometry = fragmentGeometry(), sphereGeometry = new THREE.SphereGeometry(1, 16, 10)
  const capacity = BURST_SLOTS * FRAGMENTS_PER_BURST
  const batches = new Map(Object.entries(finishes).map(([name, source]) => {
    const geometry = (name === 'bubble' ? sphereGeometry : cubeGeometry).clone()
    const finishAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('fragmentFinish', finishAttribute)
    const material = new THREE.MeshPhysicalMaterial().copy(source)
    material.color.set('#ffffff')
    material.thickness *= .2
    material.dithering = true
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute vec2 fragmentFinish; varying vec2 vFragmentFinish;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFragmentFinish = fragmentFinish;')
      shader.fragmentShader = 'varying vec2 vFragmentFinish;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * vFragmentFinish.x, 0.055, 0.85);')
      shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = clamp(metalnessFactor + vFragmentFinish.y, 0.0, 0.6);')
    }
    material.customProgramCacheKey = () => 'source-fragment-finish-v1'
    const mesh = new THREE.InstancedMesh(geometry, material, capacity)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.setColorAt(0, new THREE.Color('#ffffff'))
    mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false
    group.add(mesh)
    const batch = { mesh, geometry, material, finishAttribute, count: 0 }
    return [name, batch] as const
  }))

  const positions = new Float32Array(BURST_SLOTS * MOTES_PER_BURST * 3), colors = new Float32Array(positions.length)
  const sizes = new Float32Array(BURST_SLOTS * MOTES_PER_BURST), opacities = new Float32Array(sizes.length)
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
        float glow = exp(-d * d * 5.0) * (1.0 - smoothstep(0.6, 1.0, d));
        gl_FragColor = vec4(vColor, glow * vOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const dust = new THREE.Points(dustGeometry, dustMaterial)
  dust.frustumCulled = false; dust.visible = false
  group.add(dust)
  const dummy = new THREE.Object3D(), gravity = new THREE.Vector3(), inverse = new THREE.Quaternion(), tint = new THREE.Color()
  let activeFragments = 0

  const burst = (source: Omit<BurstSource, 'color'>) => {
    const material = finishes[source.finish]
    tint.copy(material.color)
    if (material.transmission > 0 && Number.isFinite(material.attenuationDistance)) tint.lerp(material.attenuationColor, .45)
    dynamics.burst({ ...source, color: tint })
  }
  const update = (dt: number, bodies: readonly WireBody[] = []) => {
    if (!dynamics.active && activeFragments === 0 && !dust.visible) return
    // Gravity stays vertically down on screen while the sculpture subtly tilts.
    gravity.set(0, -7.8, 0).applyQuaternion(inverse.copy(parent.quaternion).invert()).divideScalar(parent.scale.x)
    dynamics.step(dt, gravity, bodies)
    batches.forEach(batch => { batch.count = 0 })
    let dustCount = 0
    activeFragments = 0
    for (const slot of dynamics.slots) for (const particle of slot.particles) {
      if (!particle.alive) continue
      const t = particle.age / particle.lifetime
      if (particle.mote) {
        particle.position.toArray(positions, dustCount * 3)
        particle.color.toArray(colors, dustCount * 3)
        sizes[dustCount] = particle.size * 3
        opacities[dustCount++] = (1 - t) ** 1.5 * .48
      } else {
        const batch = batches.get(slot.finish)!
        // Keep fragment mass visible along the arc; taper only at the end of its life.
        const fade = 1 - THREE.MathUtils.smoothstep(t, .68, 1)
        dummy.position.copy(particle.position)
        dummy.quaternion.copy(particle.rotation)
        dummy.scale.copy(particle.proportions).multiplyScalar(particle.size * fade)
        dummy.updateMatrix()
        batch.mesh.setMatrixAt(batch.count, dummy.matrix)
        batch.mesh.setColorAt(batch.count, particle.color)
        batch.finishAttribute.setXY(batch.count++, particle.roughness, particle.metalness)
        activeFragments++
      }
    }
    batches.forEach(batch => {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0
      if (batch.count) { batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.instanceColor!.needsUpdate = true; batch.finishAttribute.needsUpdate = true }
    })
    dust.visible = dustCount > 0
    if (dustCount) {
      dustGeometry.setDrawRange(0, dustCount)
      for (const attribute of Object.values(dustGeometry.attributes)) attribute.needsUpdate = true
    }
  }
  const reset = () => { dynamics.reset(); activeFragments = 0; batches.forEach(batch => { batch.mesh.visible = false; batch.mesh.count = 0 }); dust.visible = false }
  return {
    burst, update, reset, get activeFragments() { return activeFragments },
    resize(pixelsPerUnit: number) { dustMaterial.uniforms.pixelsPerUnit.value = pixelsPerUnit },
    dispose() {
      parent.remove(group)
      batches.forEach(batch => { batch.mesh.dispose(); batch.geometry.dispose(); batch.material.dispose() })
      cubeGeometry.dispose(); sphereGeometry.dispose(); dustGeometry.dispose(); dustMaterial.dispose()
    },
  }
}
