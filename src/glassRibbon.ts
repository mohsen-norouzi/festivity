import * as THREE from 'three'
import { createWirePhysics, type WireBody } from './wirePhysics'

export const RIBBON_HALF_WIDTH = .17
const DEPTH = .027
const SEGMENTS = 256
const SIDES = 18
const EDGE_SIDES = 6
const REPEATS = 9

export function createRibbonPhysics() {
  return createWirePhysics(96, {
    // A separate, oppositely pitched orbit leaves the original fine wire intact.
    home: phase => new THREE.Vector3(
      5.05 * Math.cos(phase) * (1 + .012 * Math.sin(3 * phase)),
      .28 - 1.04 * Math.sin(phase) + .06 * Math.sin(3 * phase + .5),
      5.05 * Math.sin(phase),
    ).applyAxisAngle(new THREE.Vector3(0, 0, 1), -.2),
    // Enclose the whole band, including its curved bevel and interpolation margin.
    clearance: RIBBON_HALF_WIDTH + .05,
    nodeMass: .018,
    bending: .3,
    motion: .45,
    homeStrength: 3,
    damping: 2.5,
  })
}

/** One reusable set of buffers, shared by the near/far glass surfaces. */
export function createRibbonGeometry(nodes: THREE.Vector3[]) {
  const curve = new THREE.CatmullRomCurve3(nodes, true, 'centripetal')
  const centers = Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3())
  const arc = new Float32Array(SEGMENTS + 1)
  const tangent = new THREE.Vector3(), up = new THREE.Vector3(), normal = new THREE.Vector3()
  const axis = new THREE.Vector3(Math.sin(.2), Math.cos(.2), 0)
  const position = new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * SIDES * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const normals = new THREE.BufferAttribute(new Float32Array(position.array.length), 3).setUsage(THREE.DynamicDrawUsage)
  const colors = new THREE.BufferAttribute(new Float32Array(position.array.length), 3)
  const textPosition = new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const edgePosition = new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 2 * EDGE_SIDES * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const edgeNormal = new THREE.BufferAttribute(new Float32Array(edgePosition.array.length), 3).setUsage(THREE.DynamicDrawUsage)
  const uv = new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 4), 2)
  const glass = new THREE.BufferGeometry()
  glass.setAttribute('position', position); glass.setAttribute('normal', normals); glass.setAttribute('color', colors)
  const lettering = new THREE.BufferGeometry()
  lettering.setAttribute('position', textPosition); lettering.setAttribute('uv', uv)
  const edges = new THREE.BufferGeometry()
  edges.setAttribute('position', edgePosition); edges.setAttribute('normal', edgeNormal)
  const indices: number[] = [], textIndices: number[] = [], edgeIndices: number[] = []
  const profile = Array.from({ length: SIDES }, (_, j) => {
    const top = j < SIDES / 2
    const angle = (j % (SIDES / 2)) / (SIDES / 2 - 1) * Math.PI + (top ? 0 : Math.PI)
    return { n: DEPTH * Math.cos(angle), w: (top ? 1 : -1) * (RIBBON_HALF_WIDTH - DEPTH) + DEPTH * Math.sin(angle), nn: Math.cos(angle), nw: Math.sin(angle) }
  })
  for (let i = 0; i < SEGMENTS; i++) {
    for (let j = 0; j < SIDES; j++) {
      const a = i * SIDES + j, b = i * SIDES + (j + 1) % SIDES
      indices.push(a, b, a + SIDES, b, b + SIDES, a + SIDES)
    }
    const a = i * 2
    textIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    for (let side = 0; side < 2; side++) for (let j = 0; j < EDGE_SIDES; j++) {
      const a = i * 2 * EDGE_SIDES + side * EDGE_SIDES + j, b = i * 2 * EDGE_SIDES + side * EDGE_SIDES + (j + 1) % EDGE_SIDES
      edgeIndices.push(a, b, a + 2 * EDGE_SIDES, b, b + 2 * EDGE_SIDES, a + 2 * EDGE_SIDES)
    }
  }
  glass.setIndex(indices); lettering.setIndex(textIndices); edges.setIndex(edgeIndices)
  const warm = new THREE.Color('#b68164'), cool = new THREE.Color('#96aabb'), color = new THREE.Color()
  let uvReady = false
  const update = (reveal = 1) => {
    for (let i = 0; i < SEGMENTS; i++) curve.getPoint(i / SEGMENTS, centers[i])
    centers[SEGMENTS].copy(centers[0])
    for (let i = 1; i <= SEGMENTS; i++) arc[i] = arc[i - 1] + centers[i].distanceTo(centers[i - 1])
    for (let i = 0; i <= SEGMENTS; i++) {
      const wrapped = i % SEGMENTS, center = centers[i]
      tangent.subVectors(centers[(wrapped + 1) % SEGMENTS], centers[(wrapped + SEGMENTS - 1) % SEGMENTS]).normalize()
      // Project a common upright axis onto the tangent plane: no twisting or
      // flipping of the inscription as the flexible loop reacts to contact.
      up.copy(axis).addScaledVector(tangent, -axis.dot(tangent)).normalize()
      normal.crossVectors(up, tangent).normalize()
      for (let j = 0; j < SIDES; j++) {
        const p = profile[j], index = i * SIDES + j
        position.setXYZ(index, center.x + (normal.x * p.n + up.x * p.w) * reveal, center.y + (normal.y * p.n + up.y * p.w) * reveal, center.z + (normal.z * p.n + up.z * p.w) * reveal)
        normals.setXYZ(index, normal.x * p.nn + up.x * p.nw, normal.y * p.nn + up.y * p.nw, normal.z * p.nn + up.z * p.nw)
        if (!uvReady) {
          color.copy(warm).lerp(cool, THREE.MathUtils.clamp((center.x + 5.1) / 10.2, 0, 1))
          colors.setXYZ(index, color.r, color.g, color.b)
        }
      }
      for (let side = 0; side < 2; side++) {
        const width = (side === 0 ? -1 : 1) * (RIBBON_HALF_WIDTH - .023) * reveal
        textPosition.setXYZ(i * 2 + side, center.x + normal.x * (DEPTH + .002) * reveal + up.x * width, center.y + normal.y * (DEPTH + .002) * reveal + up.y * width, center.z + normal.z * (DEPTH + .002) * reveal + up.z * width)
        // Rest-length UVs stop the text swimming when the material stretches.
        if (!uvReady) uv.setXY(i * 2 + side, -arc[i] / arc[SEGMENTS] * REPEATS, side)
        for (let j = 0; j < EDGE_SIDES; j++) {
          const angle = j / EDGE_SIDES * Math.PI * 2
          const index = (i * 2 + side) * EDGE_SIDES + j
          const n = Math.cos(angle), w = Math.sin(angle)
          const nx = normal.x * n + up.x * w, ny = normal.y * n + up.y * w, nz = normal.z * n + up.z * w
          const edgeWidth = (side === 0 ? -1 : 1) * (RIBBON_HALF_WIDTH - .003)
          edgePosition.setXYZ(index, center.x + (up.x * edgeWidth + nx * .008) * reveal, center.y + (up.y * edgeWidth + ny * .008) * reveal, center.z + (up.z * edgeWidth + nz * .008) * reveal)
          edgeNormal.setXYZ(index, nx, ny, nz)
        }
      }
    }
    uvReady = true
    position.needsUpdate = true; normals.needsUpdate = true; textPosition.needsUpdate = true
    edgePosition.needsUpdate = true; edgeNormal.needsUpdate = true
  }
  update()
  return { glass, lettering, edges, update, dispose() { glass.dispose(); lettering.dispose(); edges.dispose() } }
}

async function inscription(anisotropy: number) {
  const logo = new Image()
  logo.src = '/brand/musync-symbol-white.svg'
  await logo.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 1536; canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#eee1d0'
  ctx.font = '500 62px Arial, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.letterSpacing = '2px'
  ctx.fillText('ARTISTS OWN TOMORROW', 663, 67)
  // Keep the original inscription layout; only the separator changes to the
  // official MUSYNC symbol, baked into the existing texture without a wordmark.
  const logoHeight = 88
  const logoWidth = logoHeight * 96 / 109
  ctx.drawImage(logo, 1405 - logoWidth / 2, (canvas.height - logoHeight) / 2, logoWidth, logoHeight)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = Math.min(anisotropy, 8)
  return texture
}

export function createGlassRibbon(parent: THREE.Group, anisotropy: number) {
  const physics = createRibbonPhysics()
  const nodes = physics.positions.map(point => point.clone())
  const geometry = createRibbonGeometry(nodes)
  let texture: THREE.CanvasTexture | undefined
  const group = new THREE.Group()
  group.name = 'Smoked inscription ribbon'
  parent.add(group)
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#252628', vertexColors: true, roughness: .28, metalness: .35,
    ior: 1.46, transparent: true, opacity: .3, depthWrite: false,
    clearcoat: .75, clearcoatRoughness: .2, envMapIntensity: 1.35,
    iridescence: .05, iridescenceIOR: 1.3, iridescenceThicknessRange: [160, 320],
    dithering: true,
  })
  const visibility = { value: 0 }
  // Smoked lacquer stays readable against the venue; the slim polished rim
  // catches stage light without another transmission capture.
  glassMaterial.onBeforeCompile = shader => {
    shader.uniforms.ribbonVisibility = visibility
    shader.fragmentShader = `uniform float ribbonVisibility;\n${shader.fragmentShader}`.replace('#include <opaque_fragment>', `
      float ribbonFresnel = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
      diffuseColor.a = mix(0.90, 0.98, ribbonFresnel) * ribbonVisibility;
      #include <opaque_fragment>
    `)
  }
  glassMaterial.customProgramCacheKey = () => 'smoked-ribbon-v2'
  const textMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: .88 })
  textMaterial.forceSinglePass = true
  const edgeMaterial = new THREE.MeshPhysicalMaterial({ color: '#d5b29b', metalness: .7, roughness: .24, clearcoat: .8, envMapIntensity: 1.6, transparent: true, opacity: .7, depthWrite: false, dithering: true })
  const slices: THREE.BufferGeometry[] = []
  // Separate draw ranges give the near/far arcs correct depth ordering relative
  // to the existing glass cubes, while sharing all vertex buffers.
  for (const front of [false, true]) {
    const surface = new THREE.BufferGeometry()
    for (const name of ['position', 'normal', 'color']) surface.setAttribute(name, geometry.glass.getAttribute(name))
    surface.setIndex(geometry.glass.index)
    surface.setDrawRange(front ? 0 : SEGMENTS / 2 * SIDES * 6, SEGMENTS / 2 * SIDES * 6)
    const mesh = new THREE.Mesh(surface, glassMaterial)
    mesh.frustumCulled = false; mesh.renderOrder = front ? 1 : -1
    group.add(mesh); slices.push(surface)
    const edge = new THREE.BufferGeometry()
    edge.setAttribute('position', geometry.edges.getAttribute('position')); edge.setAttribute('normal', geometry.edges.getAttribute('normal'))
    edge.setIndex(geometry.edges.index)
    edge.setDrawRange(front ? 0 : SEGMENTS / 2 * EDGE_SIDES * 12, SEGMENTS / 2 * EDGE_SIDES * 12)
    const rim = new THREE.Mesh(edge, edgeMaterial)
    rim.frustumCulled = false; rim.renderOrder = front ? 1 : -1
    group.add(rim); slices.push(edge)
  }
  const letters = new THREE.Mesh(geometry.lettering, textMaterial)
  letters.frustumCulled = false
  letters.renderOrder = 2
  group.add(letters)
  let amount = 0, scroll = 0
  group.visible = false
  const update = (alpha: number) => {
    if (!group.visible) return
    nodes.forEach((point, i) => point.lerpVectors(physics.previous[i], physics.positions[i], alpha))
    geometry.update(amount)
  }
  return {
    group, physics,
    async prepare() {
      if (texture) return
      texture = await inscription(anisotropy)
      textMaterial.map = texture
      textMaterial.needsUpdate = true
    },
    reveal(value: number) { amount = value; visibility.value = value; group.visible = value > 0; textMaterial.opacity = .88 * value; edgeMaterial.opacity = .7 * value },
    step(dt: number, bodies: readonly WireBody[], time: number, settling: boolean, resolveBodies: () => void) {
      if (!group.visible) return
      physics.step(dt, bodies, time, settling, resolveBodies)
      if (!settling && texture) { scroll += dt * .032; texture.offset.x = scroll % 1 }
    },
    update,
    reset() { physics.reset(); scroll = 0; if (texture) texture.offset.x = 0 },
    rest() { physics.rest() },
    dispose() {
      parent.remove(group); geometry.dispose(); slices.forEach(slice => slice.dispose())
      glassMaterial.dispose(); textMaterial.dispose(); edgeMaterial.dispose(); texture?.dispose()
    },
  }
}
