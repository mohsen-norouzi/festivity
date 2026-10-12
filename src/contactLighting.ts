import * as THREE from 'three'

/** Smooth directional contact light, compressed to second-order coefficients per shape.
 * All neighbors contribute continuously; there are no changing nearest-neighbor sets.
 * The CPU does the small pairwise solve, leaving only three texture reads per vertex.
 */
export function createContactLighting(count: number) {
  const spheres = new Float32Array(count * 4)
  const coefficients = new Float32Array(count * 12)
  const texture = new THREE.DataTexture(coefficients, count, 3, THREE.RGBAFormat, THREE.FloatType)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false

  const apply = (material: THREE.MeshPhysicalMaterial) => {
    material.onBeforeCompile = shader => {
      shader.uniforms.contactCoefficients = { value: texture }
      shader.vertexShader = `
        attribute float shapeIndex;
        uniform sampler2D contactCoefficients;
        varying float vContactVisibility;
      ` + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 contactNormal = normalize(mat3(modelMatrix) * objectNormal);
        float contactU = (shapeIndex + 0.5) / ${count}.0;
        vec4 c0 = texture2D(contactCoefficients, vec2(contactU, 0.1666667));
        vec4 c1 = texture2D(contactCoefficients, vec2(contactU, 0.5));
        vec4 c2 = texture2D(contactCoefficients, vec2(contactU, 0.8333333));
        vec3 n = contactNormal;
        float coverage = c0.x + dot(c0.yzw, n) + dot(c1.xyz, n * n)
          + 2.0 * (c1.w * n.x * n.y + c2.x * n.x * n.z + c2.y * n.y * n.z);
        vContactVisibility = exp(-max(coverage, 0.0));
      `)
      shader.fragmentShader = 'varying float vContactVisibility;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `
        #include <aomap_fragment>
        vec3 contactTint = mix(vec3(0.58, 0.49, 0.66), vec3(1.0), vContactVisibility);
        reflectedLight.indirectDiffuse *= contactTint;
        reflectedLight.directDiffuse *= mix(vec3(1.0), contactTint, 0.65);
      `)
    }
    material.customProgramCacheKey = () => 'sculpture-directional-contact-v1'
  }

  return {
    apply,
    setSphere(index: number, position: THREE.Vector3, radius: number) {
      const offset = index * 4
      spheres[offset] = position.x
      spheres[offset + 1] = position.y
      spheres[offset + 2] = position.z
      spheres[offset + 3] = radius
    },
    update() {
      coefficients.fill(0)
      for (let i = 0; i < count; i++) {
        const a = i * 4, b = a + count * 4, c = b + count * 4
        for (let j = 0; j < count; j++) {
          if (i === j) continue
          const k = j * 4
          let x = spheres[k] - spheres[a], y = spheres[k + 1] - spheres[a + 1], z = spheres[k + 2] - spheres[a + 2]
          const distance2 = x * x + y * y + z * z
          if (distance2 < .00001) continue
          const inverseDistance = 1 / Math.sqrt(distance2)
          x *= inverseDistance; y *= inverseDistance; z *= inverseDistance
          const radius2 = spheres[k + 3] ** 2
          const fade = THREE.MathUtils.smoothstep(distance2 / radius2, 4, 30)
          const weight = Math.min(1.4, radius2 / Math.max(radius2, distance2 - spheres[a + 3] ** 2 * .65) * 2.8) * (1 - fade) * .25
          coefficients[a] += weight
          coefficients[a + 1] += 2 * weight * x
          coefficients[a + 2] += 2 * weight * y
          coefficients[a + 3] += 2 * weight * z
          coefficients[b] += weight * x * x
          coefficients[b + 1] += weight * y * y
          coefficients[b + 2] += weight * z * z
          coefficients[b + 3] += weight * x * y
          coefficients[c] += weight * x * z
          coefficients[c + 1] += weight * y * z
        }
      }
      texture.needsUpdate = true
    },
    dispose() { texture.dispose() },
  }
}
