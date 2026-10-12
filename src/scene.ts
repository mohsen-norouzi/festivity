import * as THREE from 'three'
import { createMusicIcons, type MusicIcon } from './musicIcons'
import { createStudio } from './studio'
import { createOrbits } from './orbits'
import { createContactLighting } from './contactLighting'
import { createBurstLifecycle } from './burstLifecycle'
import { createBurstEffects } from './burstEffects'
import { createBurstAudio } from './burstAudio'
import { createEntrance, shuffledIndices } from './entrance'
import { createMusicAudio } from './musicAudio'
import { createMusicVisuals } from './musicVisuals'
import type { MusicState } from './musicMoods'
import { createTileReactions, type ReactionKind } from './tileReactions'

export interface OrnamentScene {
  dispose: () => void
  reset: () => void
  scatter: () => void
  toggleMusic: () => void
  setPaused: (paused: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
}

interface Body {
  enabled?: boolean
  halfSize: THREE.Vector3
  shapePower: number
  home: THREE.Vector3
  rest: THREE.Quaternion
  object: THREE.Group
  position: THREE.Vector3
  previous: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Quaternion
  spin: THREE.Vector3
  radius: number
  mass: number
  phase: number
}

type Finish = 'ink' | 'coral' | 'lilac' | 'pearl' | 'glass' | 'blue'
type Form = 'tile' | 'capsule'
interface Piece { p: [number, number, number]; r: number; finish: Finish; icon?: MusicIcon; lettering?: readonly string[]; form?: Form; tilt?: [number, number, number] }
const pieces: Piece[] = [
  { p: [-.46, .22, 2.8], r: 1.38, finish: 'glass', icon: 'wave', tilt: [.12, -.22, .24] },
  { p: [-2.22, .6, 1.83], r: 1.01, finish: 'pearl', icon: 'pause', tilt: [.16, .22, -.25] },
  { p: [-1.3, 1.86, .65], r: 1.01, finish: 'ink', icon: 'note', tilt: [.12, -.23, -.32] },
  { p: [.61, -1.45, 2.31], r: 1.02, finish: 'coral', icon: 'heart', tilt: [.15, .2, -.23] },
  { p: [1.24, 1.7, .9], r: .94, finish: 'pearl', icon: 'wave', tilt: [.17, -.15, .2] },
  { p: [1.62, .22, 2.05], r: .92, finish: 'glass', icon: 'headphones', tilt: [.12, -.32, .23] },
  { p: [2.89, -.28, 1.37], r: 1.04, finish: 'ink', lettering: ['REAL-TIME', 'ROYALTIES'], tilt: [.15, -.23, .3] },
  { p: [2.32, -1.85, 1.02], r: .98, finish: 'blue', icon: 'cloud', tilt: [.12, -.25, .22] },
  { p: [-2.24, -1.1, 1.3], r: .88, finish: 'ink', lettering: ['DIRECT', 'TO FAN'], tilt: [.14, .15, -.25] },
  { p: [-1.15, -2.03, 1.7], r: .7, finish: 'glass', icon: 'sparkle', tilt: [.13, .2, -.3] },
  { p: [-3.06, -.1, -.4], r: .92, finish: 'lilac', form: 'capsule', tilt: [.25, .22, -.12] },
  { p: [.05, 2.44, -.4], r: .7, finish: 'coral', icon: 'sparkle', tilt: [.2, -.2, .28] },
  { p: [2.3, 1.62, -.65], r: .86, finish: 'ink', lettering: ['NO', 'MIDDLEMEN'], tilt: [.2, .4, .28] },
  { p: [2.25, .6, -.48], r: .81, finish: 'blue', icon: 'play', tilt: [.2, -.3, .16] },
  { p: [3.09, .21, -.81], r: .77, finish: 'coral', tilt: [.2, .3, .3] },
  { p: [3.55, -.96, -.55], r: .61, finish: 'pearl', tilt: [.2, -.4, .35] },
  { p: [.58, -1.4, -.6], r: .94, finish: 'ink', tilt: [.2, .2, -.3] },
  { p: [-.3, -2.16, -.67], r: .78, finish: 'lilac', tilt: [.3, .4, -.4] },
  { p: [-1.08, -.7, -.2], r: .97, finish: 'coral', icon: 'note', tilt: [.2, .2, .18] },
  { p: [-2.22, 1.15, -.9], r: .91, finish: 'coral', tilt: [.3, .4, .1] },
  { p: [.55, .76, -.42], r: .99, finish: 'lilac', tilt: [.15, .3, .18] },
  { p: [1.64, -1.34, -.98], r: .86, finish: 'pearl', tilt: [.25, .15, -.3] },
  { p: [3.36, -2.08, -.37], r: .36, finish: 'ink', tilt: [.3, .4, .45] },
  { p: [-3.65, 1.9, -.5], r: .22, finish: 'coral', tilt: [.3, .2, -.2] },
  { p: [-3.68, -2.55, -.4], r: .27, finish: 'lilac', tilt: [.2, .4, .2] },
  { p: [3.38, 2.2, -.5], r: .22, finish: 'pearl', tilt: [.2, .4, -.3] },
]

const COUNT = pieces.length
const STEP = 1 / 90

function randomGenerator(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed)
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

/** A small fixed-step sphere solver: attractive force, contact impulses, and drag springs. */
export function createOrnamentScene(host: HTMLDivElement, cursor: HTMLDivElement, onReady: () => void, onError: () => void, onMusic: (state: MusicState) => void): OrnamentScene {
  const startedAt = performance.now()
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.04
  renderer.transmissionResolutionScale = .35
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.appendChild(renderer.domElement)
  const sampleCount = renderer.getContext().getParameter(renderer.getContext().SAMPLES) as number

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-6, 6, 3.5, -3.5, .1, 60)
  camera.position.set(0, 0, 20)
  camera.lookAt(0, 0, 0)
  const cluster = new THREE.Group()
  scene.add(cluster)

  const studio = createStudio(renderer, scene)
  const orbits = createOrbits(cluster, renderer.capabilities.getMaxAnisotropy())
  const burstAudio = createBurstAudio()
  let selectedMusic = -1
  let musicState: MusicState = { mood: null, playing: false, audible: false }
  const reactions = createTileReactions([
    ...pieces.map(piece => piece.lettering ? 'lettering' : piece.icon ?? 'breath'),
    ...orbits.bubbleBodies.map(() => 'bubble'),
  ] as ReactionKind[])
  const heartMaterials: THREE.MeshPhysicalMaterial[] = []
  const music = createMusicAudio(state => {
    musicState = state
    onMusic(state)
    if (import.meta.env.DEV) {
      host.dataset.musicMood = state.mood ?? ''
      host.dataset.musicPlaying = String(state.playing)
      host.dataset.musicAudible = String(state.audible)
    }
  })
  const finishes: Record<Finish, THREE.MeshPhysicalMaterial> = {
    ink: new THREE.MeshPhysicalMaterial({ color: '#101421', roughness: .32, metalness: .08, clearcoat: .32, clearcoatRoughness: .32, envMapIntensity: .9 }),
    coral: new THREE.MeshPhysicalMaterial({ color: '#f18f86', roughness: .28, metalness: 0, clearcoat: .62, clearcoatRoughness: .25, envMapIntensity: .9 }),
    lilac: new THREE.MeshPhysicalMaterial({ color: '#af8aca', roughness: .29, metalness: .03, clearcoat: .45, clearcoatRoughness: .3, envMapIntensity: 1 }),
    blue: new THREE.MeshPhysicalMaterial({ color: '#758ad1', roughness: .27, metalness: .035, clearcoat: .55, clearcoatRoughness: .28, envMapIntensity: .95 }),
    pearl: new THREE.MeshPhysicalMaterial({ color: '#f1deda', roughness: .3, metalness: 0, clearcoat: .42, clearcoatRoughness: .26, envMapIntensity: .85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#fff4fc', roughness: .18, metalness: 0, transmission: .94, thickness: .8, ior: 1.46, clearcoat: .85, clearcoatRoughness: .26, attenuationColor: '#cfaae9', attenuationDistance: 6, envMapIntensity: 1.1 }),
  }
  const burstEffects = createBurstEffects(cluster, { ...finishes, bubble: orbits.bubbleMesh.material })
  const contactLighting = createContactLighting(COUNT)
  Object.entries(finishes).forEach(([name, material]) => {
    material.dithering = true
    if (name !== 'glass') contactLighting.apply(material)
  })
  const musicVisuals = createMusicVisuals(scene, studio.background)
  const selectMusic = (index: number) => {
    if (selectedMusic === index) { music.toggle(); return }
    selectedMusic = index
    const mood = index < COUNT ? pieces[index].finish : 'bubble'
    musicVisuals.select(mood)
    music.select(mood)
  }
  // Transparent render queue excludes symbols from the glass refraction buffer.
  const glyphDark = new THREE.MeshPhysicalMaterial({ color: '#192034', metalness: .2, roughness: .33, clearcoat: .22, dithering: true, transparent: true })
  const glyphLight = new THREE.MeshPhysicalMaterial({ color: '#fff0f5', metalness: .08, roughness: .25, clearcoat: .45, dithering: true, transparent: true })
  const glyphLilac = new THREE.MeshPhysicalMaterial({ color: '#d8bde9', metalness: .25, roughness: .3, clearcoat: .3, dithering: true, transparent: true })
  const glyphPrism = new THREE.MeshPhysicalMaterial({ color: '#f5dbff', metalness: .2, roughness: .2, clearcoat: .7, emissive: '#a76fe0', emissiveIntensity: .12, dithering: true, transparent: true })
  const letterTextures: THREE.CanvasTexture[] = []
  const letterMaterials: THREE.MeshBasicMaterial[] = []
  const createLetterMaterial = (lines: readonly string[]) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.textAlign = 'center'
    context.font = '500 43px Arial, sans-serif'
    context.letterSpacing = '5px'
    context.textBaseline = 'middle'
    lines.forEach((line, i) => context.fillText(line, 256, 256 + (i - (lines.length - 1) / 2) * 64))
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    const material = new THREE.MeshBasicMaterial({ color: '#e0c9f0', map: texture, transparent: true, depthWrite: false, toneMapped: false })
    letterTextures.push(texture); letterMaterials.push(material)
    return material
  }
  const icons = createMusicIcons()
  // Evenly tessellated superellipsoids have continuous curvature across the face,
  // not just beveled corners. Analytic normals keep moving highlights smooth.
  const pillow = (width: number, height: number, depth: number, power: number, segments = 20) => {
    const geometry = new THREE.BoxGeometry(2, 2, 2, segments, segments, segments)
    const vertices = geometry.getAttribute('position')
    const normals = geometry.getAttribute('normal')
    const n = new THREE.Vector3()
    for (let i = 0; i < vertices.count; i++) {
      let x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i)
      const scale = Math.pow(Math.abs(x) ** power + Math.abs(y) ** power + Math.abs(z) ** power, -1 / power)
      x *= scale; y *= scale; z *= scale
      vertices.setXYZ(i, x * width / 2, y * height / 2, z * depth / 2)
      n.set(Math.sign(x) * Math.abs(x) ** (power - 1) / width, Math.sign(y) * Math.abs(y) ** (power - 1) / height, Math.sign(z) * Math.abs(z) ** (power - 1) / depth).normalize()
      normals.setXYZ(i, n.x, n.y, n.z)
    }
    return geometry
  }
  const prototypes: Record<Form, THREE.BufferGeometry> = {
    tile: pillow(1.6, 1.6, 1.35, 3.8),
    capsule: pillow(1.48, 1.88, 1.32, 2.8),
  }
  Object.values(prototypes).forEach(geometry => {
    geometry.computeBoundingSphere()
    const scale = 1 / geometry.boundingSphere!.radius
    geometry.scale(scale, scale, scale)
    geometry.computeBoundingBox()
  })
  const smallTile = pillow(1.6, 1.6, 1.35, 3.8, 12)
  smallTile.computeBoundingSphere()
  const satelliteScale = 1 / smallTile.boundingSphere!.radius
  smallTile.scale(satelliteScale, satelliteScale, satelliteScale)
  smallTile.computeBoundingBox()
  const interactiveMeshes: THREE.Object3D[] = [orbits.bubbleMesh]
  orbits.bubbleMesh.visible = false
  const geometries: THREE.BufferGeometry[] = []
  let random = randomGenerator(2017)
  const bodies: Body[] = []
  const offset = new THREE.Vector3()
  const delta = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const angularAxis = new THREE.Vector3()
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2(100, 100)
  const pointerWorld = new THREE.Vector3(100, 100, 1.4)
  const smoothPointer = new THREE.Vector3(100, 100, 1.4)
  const lastPointer = new THREE.Vector3(100, 100, 1.4)
  const pointerVelocity = new THREE.Vector3()
  const bubbleInteraction = { hover: false, dragging: -1, pointer: smoothPointer, dragTarget: pointerWorld, velocity: pointerVelocity }
  const cursorPosition = new THREE.Vector2(-100, -100)
  const cursorTarget = new THREE.Vector2(-100, -100)
  const pressOrigin = new THREE.Vector2()
  let canPuff = false
  let pressTime = 0, feedbackIndex = -1, feedbackTime = 0
  let active = false
  let dragging = -1
  let pointerId: number | null = null
  let dragDepth = 0
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let disposed = false
  let raf = 0
  let elapsed = 0
  let previousTime = 0
  let accumulator = 0
  let hasRendered = false
  let hasArrived = false
  let needsRender = true
  let mobile = false
  let frameCount = 0
  let sampleTime = 0

  // Physics metadata is cheap; geometry copies, icon extrusions and GPU programs
  // are prepared separately. Unprepared bodies cannot render or collide.
  pieces.forEach((piece, index) => {
    const geometry = piece.r < .5 && !piece.form ? smallTile : prototypes[piece.form ?? 'tile']
    const object = new THREE.Group()
    object.visible = false
    cluster.add(object)
    const home = new THREE.Vector3(...piece.p)
    if (index < 22) { home.x *= .94; home.y *= .9; home.z *= 1.1 }
    const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(piece.tilt ?? [.2, .2, .2])))
    bodies.push({ enabled: false, halfSize: geometry.boundingBox!.max.clone().multiplyScalar(piece.r), shapePower: piece.form === 'capsule' ? 2.8 : 3.8, home, rest, object, position: home.clone(), previous: home.clone(), velocity: new THREE.Vector3(), rotation: rest.clone(), spin: new THREE.Vector3(), radius: piece.r, mass: piece.r ** 3, phase: random() * Math.PI * 2 })
  })

  const preparePiece = (index: number) => {
    const piece = pieces[index], object = bodies[index].object
    const geometry = (piece.r < .5 && !piece.form ? smallTile : prototypes[piece.form ?? 'tile']).clone()
    geometry.setAttribute('shapeIndex', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(index), 1))
    geometries.push(geometry)
    const bodyMaterial = piece.icon === 'heart' ? finishes[piece.finish].clone() : finishes[piece.finish]
    if (piece.icon === 'heart') { contactLighting.apply(bodyMaterial); heartMaterials.push(bodyMaterial) }
    const mesh = new THREE.Mesh(geometry, bodyMaterial)
    mesh.userData.bodyIndex = index
    object.add(mesh)
    interactiveMeshes.push(mesh)
    if (piece.icon) {
      const material = piece.finish === 'glass' ? glyphPrism : piece.finish === 'ink' ? glyphLilac : piece.finish === 'pearl' ? glyphDark : glyphLight
      // Share the immutable icon mesh data between tiles, and extrude on demand.
      const glyph = new THREE.Mesh(icons.get(piece.icon), material)
      glyph.scale.setScalar(index === 0 ? 1.06 : .84)
      glyph.position.z = geometry.boundingBox!.max.z + .024
      object.add(glyph)
      reactions.register(index, glyph, piece.icon === 'heart' ? bodyMaterial : undefined)
    }
    if (piece.lettering) {
      const letterGeometry = new THREE.PlaneGeometry(1.1, 1.1)
      geometries.push(letterGeometry)
      const lettering = new THREE.Mesh(letterGeometry, createLetterMaterial(piece.lettering))
      lettering.position.z = geometry.boundingBox!.max.z + .012
      object.add(lettering)
      reactions.register(index, lettering)
    }
  }

  const fillBodies = () => {
    random = randomGenerator(2017)
    bodies.forEach(body => {
      body.position.copy(body.home); body.previous.copy(body.home)
      body.velocity.set(0, 0, 0); body.spin.set(0, 0, 0)
      body.rotation.copy(body.rest)
    })
  }

  // The glass spheres participate in the same raycast and drag path as the tiles.
  const interactiveBodies = [...bodies, ...orbits.bubbleBodies]
  interactiveBodies.forEach(body => { body.enabled = false })
  const entrance = createEntrance(interactiveBodies.length)
  const arrivedAt = new Float64Array(interactiveBodies.length).fill(-Infinity)
  const warmedFinishes = new Set<string>()
  let wireReady = false, wireReveal = 0, settleFrames = 0
  let ribbonReady = false, ribbonReveal = 0
  const baseRadii = interactiveBodies.map(body => body.radius)
  const burstOrigin = new THREE.Vector3()
  const lifecycle = createBurstLifecycle(interactiveBodies, (index, body) => {
    burstOrigin.copy(body.position)
    burstEffects.burst({ position: burstOrigin, radius: body.radius, baseRadius: baseRadii[index], halfSize: body.halfSize, rotation: body.rotation, velocity: body.velocity, shapePower: body.shapePower, finish: index < COUNT ? pieces[index].finish : 'bubble', isSphere: body.isSphere === true })
    burstAudio.play(baseRadii[index], body.isSphere === true)
    // A restrained pressure pulse passes through neighboring ornaments and cable.
    const reach = body.radius + 2.1
    interactiveBodies.forEach((neighbor, i) => {
      if (i === index || neighbor.enabled === false) return
      delta.subVectors(neighbor.position, burstOrigin)
      const distance = delta.length()
      if (distance > .001 && distance < reach) neighbor.velocity.addScaledVector(delta, (1 - distance / reach) * 3 / distance)
    })
    orbits.wire.positions.forEach((point, i) => {
      delta.subVectors(point, burstOrigin)
      const distance = delta.length()
      if (distance > .001 && distance < reach) orbits.wire.velocities[i].addScaledVector(delta, (1 - distance / reach) * 2 / distance)
    })
    orbits.ribbon.physics.positions.forEach((point, i) => {
      delta.subVectors(point, burstOrigin)
      const distance = delta.length()
      if (distance > .001 && distance < reach) orbits.ribbon.physics.velocities[i].addScaledVector(delta, (1 - distance / reach) * 1.3 / distance)
    })
    dragging = -1; canPuff = false
    cursor.classList.remove('is-dragging', 'is-charging')
    cursor.style.setProperty('--charge', '0')
    if (import.meta.env.DEV) host.dataset.lastBurst = String(index)
  }, (index, body, generation) => {
    // Start fully outside the current viewport, at the ornament's natural side.
    const angle = Math.atan2(body.home.y, body.home.x || .01) + Math.sin(index * 2.4 + generation) * .32
    const x = Math.cos(angle), y = Math.sin(angle)
    const distance = Math.min((camera.right + body.radius * cluster.scale.x * 2) / Math.max(.001, Math.abs(x)), (camera.top + body.radius * cluster.scale.x * 2) / Math.max(.001, Math.abs(y)))
    offset.set(x * distance, y * distance, body.home.z * cluster.scale.x)
    cluster.worldToLocal(offset)
    body.position.copy(offset)
    if (index < COUNT) body.rotation.copy(bodies[index].rest)
  }, index => reactions.scale(index))
  const renderBodyRadiusAt = (index: number) => lifecycle.scale(index, renderAlpha)
  const bubbleRadiusAt = (index: number) => lifecycle.scale(COUNT + index, renderAlpha)
  let renderAlpha = 1

  const step = (dt: number, settling = false) => {
    elapsed += settling ? 0 : dt
    if (!settling) {
      lifecycle.step(dt)
    }
    for (let i = 0; i < COUNT; i++) {
      const body = bodies[i]
      if (body.enabled === false) continue
      const { position: p, velocity: v, radius: r } = body
      body.previous.copy(p)
      // Gentle springs preserve the composition while every piece remains tangible.
      const float = settling ? 0 : Math.sin(elapsed * .65 + body.phase) * .11
      v.x += ((body.home.x - p.x) * 3.2 + float * .6) * dt
      v.y += ((body.home.y - p.y) * 3.8 + float) * dt
      v.z += (body.home.z - p.z) * 4.2 * dt

      if (!settling && i === dragging && !canPuff) {
        v.x += (pointerWorld.x - p.x) * 70 * dt
        v.y += (pointerWorld.y - p.y) * 70 * dt
        v.z += (dragDepth - p.z) * 70 * dt
        v.multiplyScalar(Math.exp(-7 * dt))
      } else if (!settling && active && dragging < 0) {
        delta.copy(p).sub(smoothPointer)
        // Broad front-facing influence lets even a gentle sweep rearrange the cloud.
        delta.z *= .65
        const distance = delta.length()
        const reach = r + .85
        if (distance < reach && distance > .001) {
          const strength = (1 - distance / reach) * 38
          v.addScaledVector(delta, strength * dt / distance)
          v.x += pointerVelocity.x * dt * 1.4
          v.y += pointerVelocity.y * dt * 1.4
          body.spin.x -= pointerVelocity.y * dt * .35
          body.spin.y += pointerVelocity.x * dt * .35
        }
      }
      const entering = elapsed - arrivedAt[i] < 2.5
      v.multiplyScalar(Math.exp(-(settling ? 3.2 : entering ? 2.9 : 1.75) * dt))
      v.clampLength(0, 13)
      p.addScaledVector(v, dt)
    }

    // Sequential impulses with mass-weighted positional correction keep surfaces touching.
    for (let iteration = 0; iteration < 3; iteration++) {
      for (let i = 0; i < COUNT; i++) {
        const a = bodies[i]
        if (a.enabled === false) continue
        for (let j = i + 1; j < COUNT; j++) {
          const b = bodies[j]
          if (b.enabled === false) continue
          delta.subVectors(b.position, a.position)
          const minDistance = (a.radius + b.radius) * .94
          const d2 = delta.lengthSq()
          if (d2 >= minDistance * minDistance || d2 < .000001) continue
          const distance = Math.sqrt(d2)
          delta.multiplyScalar(1 / distance)
          const aWeight = b.mass / (a.mass + b.mass)
          const bWeight = 1 - aWeight
          const correction = (minDistance - distance) * .84
          a.position.addScaledVector(delta, -correction * aWeight)
          b.position.addScaledVector(delta, correction * bWeight)
          const separationSpeed = (b.velocity.x - a.velocity.x) * delta.x + (b.velocity.y - a.velocity.y) * delta.y + (b.velocity.z - a.velocity.z) * delta.z
          if (separationSpeed < 0) {
            const impulse = -separationSpeed * 1.28
            a.velocity.addScaledVector(delta, -impulse * aWeight)
            b.velocity.addScaledVector(delta, impulse * bWeight)
          }
        }
      }
    }

    if (!settling) {
      for (const body of bodies) {
        if (body.enabled === false) continue
        body.spin.multiplyScalar(Math.exp(-1.4 * dt))
        angularAxis.set(body.spin.x + Math.sin(elapsed * .4 + body.phase) * .04, body.spin.y + Math.cos(elapsed * .3 + body.phase) * .055, body.spin.z + .015)
        const speed = angularAxis.length()
        if (speed > .00001) {
          quaternion.setFromAxisAngle(angularAxis.multiplyScalar(1 / speed), speed * dt)
          body.rotation.premultiply(quaternion).normalize()
        }
        body.rotation.slerp(body.rest, 1 - Math.exp(-.45 * dt))
      }
    }
    bubbleInteraction.hover = active && dragging < 0
    bubbleInteraction.dragging = dragging >= COUNT && !canPuff ? dragging - COUNT : -1
    orbits.step(dt, bodies, elapsed, settling, bubbleInteraction)
    if (!settling) burstEffects.step(dt, interactiveBodies)
  }

  const updateInstances = (alpha = 1) => {
    renderAlpha = alpha
    orbits.update(alpha, bubbleRadiusAt)
    cluster.rotation.y = Math.sin(elapsed * .14) * .025
    cluster.rotation.z = Math.sin(elapsed * .2) * .014
    cluster.updateMatrixWorld(true)
    bodies.forEach((body, i) => {
      body.object.visible = body.enabled !== false
      body.object.scale.setScalar(lifecycle.scale(i, alpha))
      body.object.position.lerpVectors(body.previous, body.position, alpha)
      body.object.quaternion.copy(body.rotation)
      offset.copy(body.object.position).applyMatrix4(cluster.matrixWorld)
      contactLighting.setSphere(i, offset, body.enabled === false ? 0 : body.radius * cluster.scale.x * .79)
    })
    contactLighting.update()
  }

  const reset = () => {
    dragging = -1
    canPuff = false; feedbackIndex = -1
    reactions.reset()
    lifecycle.reset(); burstEffects.reset(); burstAudio.stop()
    selectedMusic = -1; music.reset(); musicVisuals.reset()
    entrance.replay()
    interactiveBodies.forEach(body => { body.enabled = false })
    wireReveal = 0; orbits.reveal(0)
    ribbonReveal = 0; orbits.ribbon.reveal(0)
    active = false
    cursor.classList.remove('is-dragging', 'is-charging')
    cursor.style.setProperty('--charge', '0')
    elapsed = 0
    fillBodies()
    orbits.reset()
    for (const body of bodies) { body.velocity.set(0, 0, 0); body.previous.copy(body.position) }
    orbits.rest()
    updateInstances()
    needsRender = true
  }

  const scatter = () => {
    if (paused) return
    for (const body of bodies) {
      if (body.enabled === false) continue
      delta.copy(body.position).normalize()
      body.velocity.addScaledVector(delta, 4 + random() * 3)
      body.spin.add(new THREE.Vector3(random() - .5, random() - .5, random() - .5).multiplyScalar(3))
    }
  }

  const resize = () => {
    const { width, height } = host.getBoundingClientRect()
    if (!width || !height) return
    const aspect = width / height
    musicVisuals.resize(aspect)
    mobile = width < 768
    const viewHeight = mobile ? Math.max(8.2, 8.8 / aspect) : Math.max(8.2, 13.8 / aspect)
    camera.left = -viewHeight * aspect / 2
    camera.right = viewHeight * aspect / 2
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.updateProjectionMatrix()
    cluster.scale.setScalar(mobile ? .82 : 1)
    updateInstances()
    // Sharper Retina silhouettes, with a pixel budget for large desktop displays.
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1.5), 2, Math.sqrt(5_000_000 / (width * height))))
    renderer.setSize(width, height)
    burstEffects.resize(height / viewHeight * renderer.getPixelRatio() * cluster.scale.x)
    if (import.meta.env.DEV) {
      host.dataset.pixelRatio = renderer.getPixelRatio().toFixed(2)
      host.dataset.msaaSamples = String(sampleCount)
    }
    needsRender = true
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)

  const projectPointer = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    cursorTarget.set(event.clientX, event.clientY)
    offset.set(pointer.x, pointer.y, 0).unproject(camera)
    offset.z = (dragging >= 0 ? dragDepth : 1.7) * cluster.scale.x
    cluster.worldToLocal(offset)
    pointerWorld.copy(offset)
    if (!active) {
      smoothPointer.copy(pointerWorld)
      lastPointer.copy(pointerWorld)
      cursorPosition.copy(cursorTarget)
    }
    active = true
    if (event.pointerType !== 'touch') cursor.classList.add('visible')
  }

  const onMove = (event: PointerEvent) => {
    projectPointer(event)
    if (pointerId !== null && pressOrigin.distanceTo(cursorTarget) > 9) canPuff = false
  }
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointerId !== null) return
    projectPointer(event)
    burstAudio.unlock()
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(interactiveMeshes, false).find(candidate => {
      const index = candidate.object === orbits.bubbleMesh ? COUNT + candidate.instanceId! : candidate.object.userData.bodyIndex as number
      const finish = index < COUNT ? pieces[index].finish : 'bubble'
      return entrance.hasEntered(index) && interactiveBodies[index].enabled !== false && warmedFinishes.has(finish) && lifecycle.canGrab(index)
    })
    dragging = -1; canPuff = false
    if (hit) {
      dragging = hit.object === orbits.bubbleMesh ? COUNT + hit.instanceId! : hit.object.userData.bodyIndex as number
      dragDepth = interactiveBodies[dragging].position.z + .2
      projectPointer(event)
      pressOrigin.copy(cursorTarget)
      canPuff = true
      pressTime = performance.now()
    }
    pointerId = event.pointerId
    host.setPointerCapture(event.pointerId)
    cursor.classList.add('is-dragging')
  }
  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    const clicked = dragging
    const isClick = canPuff && clicked >= 0 && performance.now() - pressTime < 450 && pressOrigin.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= 9
    if (isClick) selectMusic(clicked)
    if (isClick && !paused && lifecycle.puff(clicked)) {
      feedbackIndex = clicked; feedbackTime = performance.now()
      // A click injects air without nudging the shape away from the next click.
      active = false
    }
    const releasedPointer = pointerId
    pointerId = null
    if (host.hasPointerCapture(releasedPointer)) host.releasePointerCapture(releasedPointer)
    dragging = -1
    canPuff = false
    cursor.classList.remove('is-dragging', 'is-charging')
    cursor.style.setProperty('--charge', '0')
    active = false
  }
  const onLeave = () => {
    if (pointerId !== null) return
    active = false
    cursor.classList.remove('visible')
  }
  const onCancel = () => {
    dragging = -1; pointerId = null; active = false
    canPuff = false
    cursor.classList.remove('visible', 'is-dragging', 'is-charging')
    cursor.style.setProperty('--charge', '0')
  }
  const onVisibility = () => { music.setHidden(document.hidden); previousTime = 0; accumulator = 0; if (document.hidden) { onCancel(); burstAudio.stop() } }
  const onLostCapture = (event: PointerEvent) => { if (event.pointerId === pointerId) onCancel() }
  const onContextLost = (event: Event) => { event.preventDefault(); onError() }
  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerdown', onDown)
  host.addEventListener('pointerup', onUp)
  host.addEventListener('pointercancel', onCancel)
  host.addEventListener('lostpointercapture', onLostCapture)
  host.addEventListener('pointerleave', onLeave)
  renderer.domElement.addEventListener('webglcontextlost', onContextLost)
  document.addEventListener('visibilitychange', onVisibility)

  resize()

  // This wait is cancellable, including while a background tab suspends its RAF.
  let preparationFrame = 0
  let resolveFrame: ((alive: boolean) => void) | undefined
  const nextFrame = () => new Promise<boolean>(resolve => {
    if (disposed) { resolve(false); return }
    resolveFrame = resolve
    preparationFrame = requestAnimationFrame(() => { resolveFrame = undefined; resolve(!disposed) })
  })
  const prepare = async () => {
    if (!await nextFrame()) return
    await renderer.compileAsync(orbits.wireMesh, camera, scene)
    if (disposed) return
    wireReady = true
    const order = [...shuffledIndices(10), ...shuffledIndices(COUNT - 10).map(i => i + 10)]
    // Interleave the little spheres instead of revealing the whole instance batch.
    shuffledIndices(orbits.bubbleBodies.length).forEach((index, i) => order.splice(3 + i * 5, 0, COUNT + index))
    let bubblesReady = false
    for (const index of order) {
      if (!await nextFrame()) return
      if (index < COUNT) {
        preparePiece(index)
        await renderer.compileAsync(bodies[index].object, camera, scene)
      } else if (!bubblesReady) {
        await renderer.compileAsync(orbits.bubbleMesh, camera, scene)
        bubblesReady = true
      }
      if (disposed) return
      entrance.ready(index)
      // Warm only the matching oil shader, after scheduling the ornament's arrival.
      // By the time it can be clicked, its first pop is also ready to render.
      const finish = index < COUNT ? pieces[index].finish : 'bubble'
      if (!warmedFinishes.has(finish)) {
        for (const object of burstEffects.warmupObjects(finish)) {
          if (!await nextFrame()) return
          await renderer.compileAsync(object, camera, scene)
          if (disposed) return
        }
        warmedFinishes.add(finish)
      }
    }
    // Prepare the extra glass only after the ornaments can already fly in.
    if (!await nextFrame()) return
    await orbits.ribbon.prepare()
    if (disposed) return
    await renderer.compileAsync(orbits.ribbon.group, camera, scene)
    if (disposed) return
    ribbonReady = true
    if (import.meta.env.DEV) host.dataset.preparationMs = (performance.now() - startedAt).toFixed(0)
  }

  const launch = (index: number) => {
    const body = interactiveBodies[index]
    body.enabled = true
    arrivedAt[index] = elapsed
    if (paused) {
      body.position.copy(body.home)
      settleFrames = 24
    } else {
      // Choose a different approach on each visit, favoring the body's natural
      // side so arrivals brush the sculpture rather than cutting through it.
      const angle = Math.atan2(body.home.y, body.home.x || .01) + (Math.random() - .5) * 1.25
      const x = Math.cos(angle), y = Math.sin(angle)
      const distance = Math.min((camera.right + body.radius * cluster.scale.x * 2) / Math.max(.001, Math.abs(x)), (camera.top + body.radius * cluster.scale.x * 2) / Math.max(.001, Math.abs(y)))
      offset.set(x * distance, y * distance, (body.home.z + (Math.random() - .5) * .8) * cluster.scale.x)
      cluster.worldToLocal(offset)
      body.position.copy(offset)
      body.velocity.subVectors(body.home, body.position).normalize().multiplyScalar(2 + Math.random())
      if (index < COUNT) {
        quaternion.setFromEuler(new THREE.Euler((Math.random() - .5) * .8, (Math.random() - .5) * .8, (Math.random() - .5) * 1.2))
        body.rotation.copy(bodies[index].rest).premultiply(quaternion)
        body.spin.set((Math.random() - .5) * .5, (Math.random() - .5) * .5, (Math.random() - .5) * .6)
      }
    }
    body.previous.copy(body.position)
    if (index >= COUNT) orbits.bubbleMesh.visible = true
    needsRender = true
    if (!hasArrived) {
      hasArrived = true
      if (import.meta.env.DEV) host.dataset.firstArrivalMs = (performance.now() - startedAt).toFixed(0)
    }
  }

  const tick = (now: number) => {
    if (disposed) return
    raf = requestAnimationFrame(tick)
    if (document.hidden) return
    const dt = previousTime ? Math.min((now - previousTime) / 1000, .06) : STEP
    previousTime = now
    if (import.meta.env.DEV) {
      if (!sampleTime) sampleTime = now
      if (++frameCount === 120) {
        host.dataset.fps = ((frameCount * 1000) / (now - sampleTime)).toFixed(0)
        host.dataset.drawCalls = String(renderer.info.render.calls)
        host.dataset.triangles = String(renderer.info.render.triangles)
        host.dataset.wireContacts = String(orbits.wire.contacts)
        host.dataset.ribbonContacts = String(orbits.ribbon.physics.contacts)
        host.dataset.bursts = String(lifecycle.pops)
        host.dataset.soundPlays = String(burstAudio.plays)
        host.dataset.lastSound = burstAudio.lastSound
        frameCount = 0; sampleTime = now
      }
    }
    const sound = music.sample()
    if (reactions.update(dt, selectedMusic, musicState.audible, sound, paused)) needsRender = true
    entrance.step(dt, launch)
    if (wireReady && entrance.entered > 0 && wireReveal < 1) {
      wireReveal = paused ? 1 : Math.min(1, wireReveal + dt * .9)
      orbits.reveal(wireReveal * wireReveal * (3 - 2 * wireReveal))
      needsRender = true
    }
    if (ribbonReady && entrance.complete && (paused || elapsed > 4) && ribbonReveal < 1) {
      ribbonReveal = paused ? 1 : Math.min(1, ribbonReveal + dt * .75)
      orbits.ribbon.reveal(ribbonReveal * ribbonReveal * (3 - 2 * ribbonReveal))
      needsRender = true
    }
    if (paused && (needsRender || settleFrames > 0)) {
      if (settleFrames > 0) { for (let i = 0; i < 4; i++) step(STEP, true); settleFrames-- }
      orbits.rest()
      bodies.forEach(body => body.previous.copy(body.position))
      updateInstances()
      needsRender = true
    }
    if (import.meta.env.DEV) {
      host.dataset.prepared = String(entrance.prepared)
      host.dataset.entered = String(entrance.entered)
      host.dataset.entrance = entrance.complete ? 'complete' : 'arriving'
    }
    cursorPosition.lerp(cursorTarget, 1 - Math.exp(-24 * dt))
    cursor.style.transform = `translate3d(${cursorPosition.x}px, ${cursorPosition.y}px, 0)`
    if (!paused) {
      smoothPointer.lerp(pointerWorld, 1 - Math.exp(-18 * dt))
      pointerVelocity.subVectors(smoothPointer, lastPointer).multiplyScalar(1 / Math.max(dt, .001)).clampLength(0, 22)
      lastPointer.copy(smoothPointer)
      accumulator += dt
      let steps = 0
      while (accumulator >= STEP && steps++ < 6) { step(STEP); accumulator -= STEP }
      accumulator = Math.max(0, Math.min(accumulator, STEP))
      updateInstances(accumulator / STEP)
      burstEffects.render(interactiveBodies, renderAlpha, renderBodyRadiusAt)
      const charge = feedbackIndex >= 0 ? lifecycle.states[feedbackIndex].charge : 0
      cursor.classList.toggle('is-charging', charge > 0 && now - feedbackTime < 1800)
      cursor.style.setProperty('--charge', String(charge))
      if (import.meta.env.DEV) {
        host.dataset.wetDrops = String(burstEffects.surfaceDrops)
        host.dataset.oilStrands = String(burstEffects.oilStrands)
        host.dataset.liquidDrops = String(burstEffects.activeFragments)
        host.dataset.charging = String(feedbackIndex)
        host.dataset.puffs = String(feedbackIndex >= 0 ? lifecycle.states[feedbackIndex].puffs : 0)
        host.dataset.charge = charge.toFixed(2)
        host.dataset.replacements = String(lifecycle.states.filter(state => state.phase === 'arriving').length)
      }
      needsRender = true
    }
    if (musicVisuals.update(dt, sound.energy, paused || !musicState.audible)) needsRender = true
    host.parentElement?.style.setProperty('--music-energy', sound.energy.toFixed(3))
    if (import.meta.env.DEV) {
      host.dataset.musicEnergy = sound.energy.toFixed(4)
      host.dataset.musicContext = music.contextState
      host.dataset.musicVoices = String(music.voices)
      host.dataset.musicNotes = String(music.scheduledNotes)
      host.dataset.musicSelected = String(selectedMusic)
      host.dataset.musicReaction = reactions.kind(selectedMusic)
      host.dataset.reactionActivity = reactions.activity(selectedMusic).toFixed(3)
      host.dataset.reactionScale = reactions.scale(selectedMusic).toFixed(4)
    }
    if (needsRender) {
      musicVisuals.paint(renderer)
      renderer.render(scene, camera)
      needsRender = false
    }
    if (!hasRendered) {
      hasRendered = true
      if (import.meta.env.DEV) host.dataset.firstFrameMs = (performance.now() - startedAt).toFixed(0)
      onReady()
    }
  }
  raf = requestAnimationFrame(tick)
  const preparation = prepare().catch(cause => {
    if (!disposed) { console.error('Unable to prepare the sculpture', cause); onError() }
  })
  const releaseResources = () => {
    geometries.forEach(geometry => geometry.dispose())
    Object.values(prototypes).forEach(geometry => geometry.dispose())
    smallTile.dispose(); icons.dispose()
    Object.values(finishes).forEach(material => material.dispose())
    glyphDark.dispose(); glyphLight.dispose(); glyphLilac.dispose(); glyphPrism.dispose()
    letterMaterials.forEach(material => material.dispose())
    letterTextures.forEach(texture => texture.dispose())
    orbits.dispose(); studio.dispose()
    contactLighting.dispose(); musicVisuals.dispose(); reactions.dispose()
    heartMaterials.forEach(material => material.dispose())
    burstEffects.dispose(); burstAudio.dispose()
    renderer.dispose()
  }

  return {
    reset, scatter,
    toggleMusic() { if (selectedMusic < 0) selectMusic(0); else music.toggle() },
    setPaused(value) {
      paused = value; accumulator = 0; needsRender = true
      if (value) {
        onCancel(); burstAudio.stop()
        // Pausing / reduced motion completes arrivals in place, never off-screen.
        interactiveBodies.forEach((body, index) => {
          if (entrance.hasEntered(index) && elapsed - arrivedAt[index] < 5) {
            body.position.copy(body.home); body.previous.copy(body.home); body.velocity.set(0, 0, 0)
            if (index < COUNT) body.rotation.copy(bodies[index].rest)
          }
        })
        settleFrames = 24
      }
    },
    setSoundEnabled(value) { burstAudio.setMuted(!value); music.setMuted(!value) },
    dispose() {
      if (disposed) return
      disposed = true
      music.dispose()
      burstAudio.stop()
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onCancel)
      host.removeEventListener('lostpointercapture', onLostCapture)
      host.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      cancelAnimationFrame(preparationFrame)
      resolveFrame?.(false)
      // Three's async shader poll owns these materials until it resolves. Keep
      // them alive through teardown to avoid an isReady/disposed-program race.
      void preparation.finally(releaseResources)
      renderer.domElement.remove()
      cursor.classList.remove('visible', 'is-dragging')
    },
  }
}
