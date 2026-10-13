import * as THREE from 'three'
import { createBurstDynamics, BURST_SLOTS, FRAGMENTS_PER_BURST, MOTES_PER_BURST, SURFACE_DROPS, type BurstSource } from './burstDynamics'
import type { WireBody } from './wirePhysics'

import { oilVertex } from './oilSurface'

/** Colored liquid with a fixed pool of persistent, surface-conforming wet beads. */
export function createBurstEffects(parent: THREE.Group, finishes: Record<string, THREE.MeshPhysicalMaterial>) {
  const group = new THREE.Group()
  parent.add(group)
  const dynamics = createBurstDynamics()
  const sphereGeometry = new THREE.SphereGeometry(1, 20, 32)
  const capacity = BURST_SLOTS * FRAGMENTS_PER_BURST + SURFACE_DROPS
  const batches = new Map(Object.entries(finishes).map(([name, source]) => {
    const geometry = sphereGeometry.clone()
    const finishAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(THREE.DynamicDrawUsage)
    const liquidAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage)
    const motionAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage)
    const anchorAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage)
    const shapeAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('fragmentFinish', finishAttribute)
    geometry.setAttribute('liquidState', liquidAttribute)
    geometry.setAttribute('oilMotion', motionAttribute)
    geometry.setAttribute('surfaceAnchor', anchorAttribute)
    geometry.setAttribute('surfaceShape', shapeAttribute)
    const material = new THREE.MeshPhysicalMaterial().copy(source)
    material.color.set('#ffffff')
    // Painted surface wear belongs to the shell, not to its liquid droplets.
    material.map = material.roughnessMap = material.bumpMap = material.normalMap = material.clearcoatRoughnessMap = null
    material.metalness = 0
    material.roughness = name === 'ink' ? .17 : .13
    material.clearcoat = .45; material.clearcoatRoughness = .11
    material.ior = 1.46
    material.transmission = name === 'glass' || name === 'bubble' ? .78 : name === 'ink' ? .04 : .42
    material.thickness = .22
    material.iridescence = Math.min(.16, source.iridescence)
    material.attenuationColor.copy(source.color)
    if (source.userData.liquidColor) material.attenuationColor.set(source.userData.liquidColor)
    material.attenuationDistance = .8
    material.envMapIntensity = 1.05
    material.dithering = true
    material.onBeforeCompile = shader => {
      shader.vertexShader = oilVertex + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal; vec3 liquidPosition = liquidVertexPosition(position, objectNormal);')
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = liquidPosition; vFragmentFinish = fragmentFinish; vLiquidThickness = liquidState.w > 0.5 ? liquidState.z : (liquidState.w < -0.5 ? max(liquidState.x, liquidState.y) * 1.6 : length(instanceMatrix[0].xyz) * 1.6);')
      shader.fragmentShader = 'varying vec2 vFragmentFinish;\nvarying float vLiquidThickness;\n' + shader.fragmentShader
      // Refraction follows the actual film height; a thin wet cap is not a deep
      // lens sampling dark geometry from behind its host.
      shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', THREE.ShaderChunk.transmission_fragment.replace('material.thickness = thickness;', 'material.thickness = min(thickness, vLiquidThickness);'))
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * vFragmentFinish.x, 0.055, 0.85);')
      shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = clamp(metalnessFactor + vFragmentFinish.y, 0.0, 0.6);')
    }
    material.customProgramCacheKey = () => 'flowing-oil-lobes-v5'
    const mesh = new THREE.InstancedMesh(geometry, material, capacity)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.setColorAt(0, new THREE.Color('#ffffff'))
    mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false
    group.add(mesh)
    const batch = { mesh, geometry, material, finishAttribute, liquidAttribute, motionAttribute, anchorAttribute, shapeAttribute, count: 0 }
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
  const axis = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3(), bend = new THREE.Vector3()
  const current = new THREE.Vector3(), other = new THREE.Vector3()
  const localNormal = new THREE.Vector3(), tangent = new THREE.Vector3(), bitangent = new THREE.Vector3()
  let activeFragments = 0, activeNecks = 0

  const burst = (source: Omit<BurstSource, 'color'>) => {
    const material = finishes[source.finish]
    tint.copy(material.color)
    if (material.userData.liquidColor) tint.set(material.userData.liquidColor)
    if (material.transmission > 0 && Number.isFinite(material.attenuationDistance)) tint.lerp(material.attenuationColor, .45)
    dynamics.burst({ ...source, color: tint })
  }
  const step = (dt: number, bodies: readonly WireBody[] = []) => {
    // Gravity stays vertically down on screen while the sculpture subtly tilts.
    gravity.set(0, -7.8, 0).applyQuaternion(inverse.copy(parent.quaternion).invert()).divideScalar(parent.scale.x)
    dynamics.step(dt, gravity, bodies)
  }
  const render = (bodies: readonly WireBody[] = [], alpha = 1, radiusAt?: (index: number) => number) => {
    if (!dynamics.active && activeFragments === 0 && !dust.visible) return
    batches.forEach(batch => { batch.count = 0 })
    let dustCount = 0
    activeFragments = activeNecks = 0
    for (const slot of dynamics.slots) for (const [index, particle] of slot.particles.entries()) {
      if (!particle.alive) continue
      const t = particle.age / particle.lifetime
      if (particle.mote) {
        current.lerpVectors(particle.previous, particle.position, alpha).toArray(positions, dustCount * 3)
        particle.color.toArray(colors, dustCount * 3)
        sizes[dustCount] = particle.size * 3
        opacities[dustCount++] = (1 - t) ** 1.5 * .48
      } else {
        const batch = batches.get(particle.finish)!
        const following = slot.particles[index + 1]
        // The paired mesh owns both lobes until their connecting neck pinches off.
        if (following?.alive && following.link === index && following.neck > .012) { activeFragments++; continue }
        const partner = particle.link >= 0 ? slot.particles[particle.link] : undefined
        current.lerpVectors(particle.previous, particle.position, alpha)
        const fade = 1 - THREE.MathUtils.smoothstep(t, .86, 1)
        if (partner?.alive && particle.neck > .012) {
          activeNecks++
          other.lerpVectors(partner.previous, partner.position, alpha)
          direction.subVectors(current, other)
          const distance = Math.max(.0001, direction.length())
          dummy.position.copy(current).add(other).multiplyScalar(.5)
          dummy.quaternion.setFromUnitVectors(axis, direction.multiplyScalar(1 / distance))
          dummy.scale.setScalar(1)
          bend.copy(gravity).applyQuaternion(inverse.copy(dummy.quaternion).invert()).multiplyScalar(Math.min(.022, particle.age * particle.age * .028))
          batch.liquidAttribute.setXYZW(batch.count, partner.size * fade, particle.size * fade, distance, -1)
          batch.anchorAttribute.setXYZ(batch.count, bend.x, 0, bend.z)
          batch.motionAttribute.setXYZW(batch.count, particle.phase, particle.age, particle.neck, 0)
          tint.copy(particle.color).lerp(partner.color, .5)
        } else {
          dummy.position.copy(current)
          dummy.quaternion.copy(particle.rotation)
          dummy.scale.copy(particle.proportions).multiplyScalar(particle.size * fade)
          batch.liquidAttribute.setXYZW(batch.count, 0, 0, 0, 0)
          batch.motionAttribute.setXYZW(batch.count, particle.phase, particle.age, .24 * Math.exp(-particle.age * .6) + .045, 0)
          tint.copy(particle.color)
        }
        dummy.updateMatrix()
        batch.mesh.setMatrixAt(batch.count, dummy.matrix)
        batch.mesh.setColorAt(batch.count, tint)
        batch.finishAttribute.setXY(batch.count++, particle.roughness, particle.metalness)
        activeFragments++
      }
    }
    for (const drop of dynamics.deposits) {
      if (!drop.alive) continue
      const body = bodies[drop.bodyIndex], batch = batches.get(drop.finish)!
      const renderScale = radiusAt ? radiusAt(drop.bodyIndex) / body.radius : 1
      const previous = (body as WireBody & { previous?: THREE.Vector3 }).previous
      if (previous) dummy.position.lerpVectors(previous, body.position, alpha)
      else dummy.position.copy(body.position)
      dummy.quaternion.copy(body.rotation); dummy.scale.setScalar(renderScale); dummy.updateMatrix()
      const spread = 1 + 1.35 * (1 - Math.exp(-drop.age * 6)) + Math.sin(drop.age * 8) * Math.exp(-drop.age * 2) * drop.impact * .35
      const width = Math.min(drop.size * spread, body.radius * .27)
      const height = drop.size * (.29 + .72 * Math.exp(-drop.age * 7))
      const elongation = 1 + Math.min(.75, drop.flow.length() * 5)
      localNormal.copy(drop.normal).applyQuaternion(inverse.copy(body.rotation).invert())
      tangent.set(Math.abs(localNormal.y) > .95 ? 1 : 0, Math.abs(localNormal.y) > .95 ? 0 : 1, 0).cross(localNormal).normalize()
      bitangent.crossVectors(localNormal, tangent)
      const angle = drop.flow.lengthSq() > .000001 ? Math.atan2(drop.flow.dot(bitangent), drop.flow.dot(tangent)) : drop.phase
      batch.mesh.setMatrixAt(batch.count, dummy.matrix)
      batch.mesh.setColorAt(batch.count, drop.color)
      batch.anchorAttribute.setXYZ(batch.count, drop.anchor.x, drop.anchor.y, drop.anchor.z)
      batch.shapeAttribute.setXYZ(batch.count, body.halfSize.x, body.halfSize.y, body.halfSize.z)
      batch.liquidAttribute.setXYZW(batch.count, width * drop.aspect * elongation, width / (drop.aspect * elongation), height, body.isSphere ? 2 : body.shapePower)
      batch.motionAttribute.setXYZW(batch.count, drop.phase, drop.age, 0, angle)
      batch.finishAttribute.setXY(batch.count++, drop.roughness, 0)
    }
    batches.forEach(batch => {
      batch.mesh.count = batch.count; batch.mesh.visible = batch.count > 0
      if (batch.count) {
        batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.instanceColor!.needsUpdate = true
        batch.finishAttribute.needsUpdate = true; batch.liquidAttribute.needsUpdate = true
        batch.motionAttribute.needsUpdate = true
        batch.anchorAttribute.needsUpdate = true; batch.shapeAttribute.needsUpdate = true
      }
    })
    dust.visible = dustCount > 0
    if (dustCount) {
      dustGeometry.setDrawRange(0, dustCount)
      for (const attribute of Object.values(dustGeometry.attributes)) attribute.needsUpdate = true
    }
  }
  const reset = () => { dynamics.reset(); activeFragments = activeNecks = 0; batches.forEach(batch => { batch.mesh.visible = false; batch.mesh.count = 0 }); dust.visible = false }
  return {
    warmupObjects: (finish: string) => [batches.get(finish)!.mesh, dust],
    burst, step, render, reset,
    update(dt: number, bodies: readonly WireBody[] = [], alpha = 1) { step(dt, bodies); render(bodies, alpha) },
    get activeFragments() { return activeFragments }, get surfaceDrops() { return dynamics.surfaceCount },
    get oilStrands() { return activeNecks },
    resize(pixelsPerUnit: number) { dustMaterial.uniforms.pixelsPerUnit.value = pixelsPerUnit },
    dispose() {
      parent.remove(group)
      batches.forEach(batch => { batch.mesh.dispose(); batch.geometry.dispose(); batch.material.dispose() })
      sphereGeometry.dispose(); dustGeometry.dispose(); dustMaterial.dispose()
    },
  }
}
