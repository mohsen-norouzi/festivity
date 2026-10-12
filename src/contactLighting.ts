import * as THREE from 'three'

const NEIGHBORS = 8

/** Continuous sphere occlusion, evaluated on the material rather than on a pixel grid. */
export function createContactLighting(count: number, geometry: THREE.BufferGeometry, material: THREE.MeshPhysicalMaterial) {
  const indices = Float32Array.from({ length: count }, (_, i) => i)
  geometry.setAttribute('ornamentIndex', new THREE.InstancedBufferAttribute(indices, 1))

  const positions = new Float32Array(count * 4)
  const neighbors = new Float32Array(count * NEIGHBORS * 4)
  const nearestDistances = new Float32Array(NEIGHBORS)
  const nearestIndices = new Int16Array(NEIGHBORS)
  const texture = new THREE.DataTexture(neighbors, NEIGHBORS, count, THREE.RGBAFormat, THREE.FloatType)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false

  material.onBeforeCompile = shader => {
    shader.uniforms.contactNeighbors = { value: texture }
    shader.vertexShader = `
      attribute float ornamentIndex;
      varying float vOrnamentIndex;
      varying vec3 vContactPosition;
      varying vec3 vContactNormal;
    ` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vOrnamentIndex = ornamentIndex;
      vContactPosition = (instanceMatrix * vec4(transformed, 1.0)).xyz;
      vContactNormal = mat3(instanceMatrix) * objectNormal;
    `)
    shader.fragmentShader = `
      uniform sampler2D contactNeighbors;
      varying float vOrnamentIndex;
      varying vec3 vContactPosition;
      varying vec3 vContactNormal;
    ` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `
      #include <aomap_fragment>
      vec3 contactNormal = normalize(vContactNormal);
      float visibility = 1.0;
      for (int neighborIndex = 0; neighborIndex < ${NEIGHBORS}; neighborIndex++) {
        vec4 neighbor = texture2D(contactNeighbors, vec2(
          (float(neighborIndex) + 0.5) / ${NEIGHBORS}.0,
          (vOrnamentIndex + 0.5) / ${count}.0
        ));
        vec3 toNeighbor = neighbor.xyz - vContactPosition;
        float radiusSquared = neighbor.w * neighbor.w;
        float distanceSquared = max(dot(toNeighbor, toNeighbor), radiusSquared + 0.0001);
        float facing = max(dot(contactNormal, toNeighbor) * inversesqrt(distanceSquared), 0.0);
        float coverage = facing * radiusSquared / distanceSquared;
        visibility *= 1.0 - min(coverage * 0.88, 0.94);
      }
      // A soft rose bounce in the crevices; reflections retain their brightness.
      vec3 contactTint = mix(vec3(0.86, 0.48, 0.51), vec3(1.0), visibility);
      reflectedLight.indirectDiffuse *= contactTint;
      reflectedLight.directDiffuse *= mix(vec3(1.0), contactTint, 0.72);
    `)
  }
  material.customProgramCacheKey = () => 'ornament-contact-lighting-v1'

  return {
    setSphere(index: number, position: THREE.Vector3, radius: number) {
      const offset = index * 4
      positions[offset] = position.x
      positions[offset + 1] = position.y
      positions[offset + 2] = position.z
      positions[offset + 3] = radius
    },
    update() {
      // Reuse all buffers. Only eight closest occluders are sampled per fragment.
      for (let i = 0; i < count; i++) {
        const offset = i * 4
        nearestDistances.fill(Infinity)
        nearestIndices.fill(-1)
        for (let j = 0; j < count; j++) {
          if (i === j) continue
          const other = j * 4
          const dx = positions[other] - positions[offset]
          const dy = positions[other + 1] - positions[offset + 1]
          const dz = positions[other + 2] - positions[offset + 2]
          const combinedRadius = positions[other + 3] + positions[offset + 3]
          const distance = (dx * dx + dy * dy + dz * dz) / (combinedRadius * combinedRadius)
          if (distance >= nearestDistances[NEIGHBORS - 1]) continue
          let slot = NEIGHBORS - 1
          while (slot > 0 && distance < nearestDistances[slot - 1]) {
            nearestDistances[slot] = nearestDistances[slot - 1]
            nearestIndices[slot] = nearestIndices[slot - 1]
            slot--
          }
          nearestDistances[slot] = distance
          nearestIndices[slot] = j
        }
        for (let n = 0; n < NEIGHBORS; n++) {
          const target = (i * NEIGHBORS + n) * 4
          const source = nearestIndices[n] * 4
          neighbors[target] = positions[source]
          neighbors[target + 1] = positions[source + 1]
          neighbors[target + 2] = positions[source + 2]
          neighbors[target + 3] = positions[source + 3]
        }
      }
      texture.needsUpdate = true
    },
    dispose() { texture.dispose() },
  }
}
