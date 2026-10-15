import * as THREE from 'three'
import { createMusicIcons, type MusicIcon } from './musicIcons'
import { createStudio } from './studio'
import { createUndergroundSurfaces, type TileArtwork } from './undergroundSurfaces'
import { createOrbits } from './orbits'
import { createContactLighting } from './contactLighting'
import { createBurstLifecycle } from './burstLifecycle'
import { createBalloonJourney, type JourneyPhase } from './balloonJourney'
import { createBalloonFlight } from './balloonFlight'
import { createBodyContacts } from './bodyContacts'
import { createBurstEffects } from './burstEffects'
import { createBurstAudio } from './burstAudio'
import { createEntrance, shuffledIndices } from './entrance'
import { createMusicAudio } from './musicAudio'
import { createMusicVisuals } from './musicVisuals'
import type { MoodId, MusicState } from './musicMoods'
import { createTileReactions, type ReactionKind } from './tileReactions'

export interface OrnamentScene {
  dispose: () => void
  reset: () => void
  scatter: () => void
  toggleMusic: () => void
  selectTrack: (mood: MoodId) => void
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
  previousRotation: THREE.Quaternion
  spin: THREE.Vector3
  radius: number
  mass: number
  phase: number
}

type Finish = 'ink' | 'coral' | 'lilac' | 'pearl' | 'glass' | 'blue'
type Form = 'tile' | 'capsule'
interface Piece { p: [number, number, number]; r: number; finish: Finish; icon?: MusicIcon; artwork?: TileArtwork; lettering?: readonly string[]; form?: Form; tilt?: [number, number, number] }
const pieces: Piece[] = [
  { p: [-.46, .22, 2.8], r: 1.38, finish: 'glass', artwork: 'live', tilt: [.12, -.22, .24] },
  { p: [-2.22, .6, 1.83], r: 1.01, finish: 'pearl', artwork: 'poster', tilt: [.16, .22, -.25] },
  { p: [-1.3, 1.86, .65], r: 1.01, finish: 'ink', lettering: ['GOOD', 'MUSIC', 'PEOPLE'], tilt: [.12, -.23, -.32] },
  { p: [.61, -1.45, 2.31], r: 1.02, finish: 'coral', icon: 'heart', tilt: [.15, .2, -.23] },
  { p: [1.24, 1.7, .9], r: .94, finish: 'lilac', artwork: 'brand', tilt: [.17, -.15, .2] },
  { p: [1.62, .22, 2.05], r: .92, finish: 'glass', icon: 'headphones', tilt: [.12, -.32, .23] },
  { p: [2.89, -.28, 1.37], r: 1.04, finish: 'ink', icon: 'wave', tilt: [.15, -.23, .3] },
  { p: [2.32, -1.85, 1.02], r: .98, finish: 'coral', lettering: ['OWN', 'YOUR', 'SOUND'], tilt: [.12, -.25, .22] },
  { p: [-2.24, -1.1, 1.3], r: .88, finish: 'ink', icon: 'globe', tilt: [.14, .15, -.25] },
  { p: [-1.15, -2.03, 1.7], r: .7, finish: 'glass', artwork: 'vinyl', tilt: [.13, .2, -.3] },
  { p: [-3.06, -.1, -.4], r: .92, finish: 'lilac', form: 'capsule', tilt: [.25, .22, -.12] },
  { p: [.05, 2.44, -.4], r: .7, finish: 'coral', icon: 'sparkle', tilt: [.2, -.2, .28] },
  { p: [2.3, 1.62, -.65], r: .86, finish: 'ink', icon: 'sparkle', tilt: [.2, .4, .28] },
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
export function createOrnamentScene(host: HTMLDivElement, cursor: HTMLDivElement, onReady: () => void, onError: () => void, onMusic: (state: MusicState) => void, onJourney: (phase: JourneyPhase) => void = () => {}): OrnamentScene {
  const startedAt = performance.now()
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
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
  const surfaces = createUndergroundSurfaces(renderer.capabilities.getMaxAnisotropy())
  const patina = { roughnessMap: surfaces.roughness, clearcoatRoughnessMap: surfaces.roughness, bumpMap: surfaces.roughness, bumpScale: .0045 }
  const finishes: Record<Finish, THREE.MeshPhysicalMaterial> = {
    ink: new THREE.MeshPhysicalMaterial({ color: '#b1a6aa', map: surfaces.ink, ...patina, roughness: .36, metalness: .28, clearcoat: .6, clearcoatRoughness: .22, envMapIntensity: 1.1 }),
    coral: new THREE.MeshPhysicalMaterial({ color: '#f46c51', map: surfaces.paint, ...patina, roughness: .38, metalness: .08, clearcoat: .48, clearcoatRoughness: .25, envMapIntensity: .9 }),
    lilac: new THREE.MeshPhysicalMaterial({ color: '#f53bb0', map: surfaces.paint, ...patina, roughness: .36, metalness: .1, clearcoat: .62, clearcoatRoughness: .22, envMapIntensity: 1 }),
    blue: new THREE.MeshPhysicalMaterial({ color: '#9678bd', map: surfaces.paint, ...patina, roughness: .4, metalness: .4, clearcoat: .5, clearcoatRoughness: .24, envMapIntensity: 1.05 }),
    pearl: new THREE.MeshPhysicalMaterial({ color: '#f4e4d8', map: surfaces.paper, ...patina, roughness: .49, metalness: .02, clearcoat: .35, clearcoatRoughness: .32, envMapIntensity: .85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#fff4f8', roughness: .115, metalness: 0, transmission: .96, thickness: .42, ior: 1.46, clearcoat: .8, clearcoatRoughness: .2, attenuationColor: '#e7b4d9', attenuationDistance: 10, envMapIntensity: 1.4 }),
  }
  finishes.ink.userData.liquidColor = '#17191b'
  const burstEffects = createBurstEffects(cluster, { ...finishes, bubble: orbits.bubbleMesh.material })
  const contactLighting = createContactLighting(COUNT)
  Object.entries(finishes).forEach(([name, material]) => {
    material.dithering = true
    if (name !== 'glass') contactLighting.apply(material)
  })
  const musicVisuals = createMusicVisuals(scene)
  const selectMusic = (index: number) => {
    selectedMusic = index
    const mood = index < COUNT ? pieces[index].finish : 'bubble'
    musicVisuals.select(mood)
    music.select(mood)
  }
  // Transparent render queue excludes symbols from the glass refraction buffer.
  const glyphDark = new THREE.MeshPhysicalMaterial({ color: '#121416', metalness: .2, roughness: .33, clearcoat: .22, dithering: true, transparent: true })
  const glyphLight = new THREE.MeshPhysicalMaterial({ color: '#f0dfc9', metalness: .08, roughness: .25, clearcoat: .45, dithering: true, transparent: true })
  const glyphLilac = new THREE.MeshPhysicalMaterial({ color: '#d9c8b5', metalness: .25, roughness: .3, clearcoat: .3, dithering: true, transparent: true })
  const glyphPrism = new THREE.MeshPhysicalMaterial({ color: '#f7dce9', metalness: .2, roughness: .2, clearcoat: .7, emissive: '#e794b8', emissiveIntensity: .12, dithering: true, transparent: true })
  const artworkMaterials: THREE.MeshPhysicalMaterial[] = []
  const letterTextures: THREE.CanvasTexture[] = []
  const letterMaterials: THREE.MeshBasicMaterial[] = []
  const createLetterMaterial = (lines: readonly string[], dark: boolean) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const context = canvas.getContext('2d')!
    context.fillStyle = '#ffffff'
    context.textAlign = 'center'
    context.font = '400 92px "Permanent Marker", Arial, sans-serif'
    context.letterSpacing = '-2px'
    context.textBaseline = 'middle'
    lines.forEach((line, i) => context.fillText(line, 256, 256 + (i - (lines.length - 1) / 2) * 95))
    context.globalCompositeOperation = 'destination-out'
    const scuff = randomGenerator(12)
    for (let i = 0; i < 850; i++) { context.fillStyle = `rgba(0,0,0,${scuff() * .8})`; context.fillRect(scuff() * 512, scuff() * 512, .6 + scuff() * 3, .5 + scuff()) }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    const material = new THREE.MeshBasicMaterial({ color: dark ? '#141514' : '#e4d6c7', map: texture, transparent: true, depthWrite: false, toneMapped: false })
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
  let canClick = false
  let pressTime = 0, feedbackIndex = -1
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
    bodies.push({ enabled: false, halfSize: geometry.boundingBox!.max.clone().multiplyScalar(piece.r), shapePower: piece.form === 'capsule' ? 2.8 : 3.8, home, rest, object, position: home.clone(), previous: home.clone(), velocity: new THREE.Vector3(), rotation: rest.clone(), previousRotation: rest.clone(), spin: new THREE.Vector3(), radius: piece.r, mass: piece.r ** 3, phase: random() * Math.PI * 2 })
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
      const material = piece.finish === 'glass' ? glyphPrism : piece.finish === 'ink' ? glyphLilac : ['pearl', 'coral', 'lilac'].includes(piece.finish) ? glyphDark : glyphLight
      // Share the immutable icon mesh data between tiles, and extrude on demand.
      const glyph = new THREE.Mesh(icons.get(piece.icon), material)
      glyph.scale.setScalar(index === 0 ? 1.06 : .84)
      glyph.position.z = geometry.boundingBox!.max.z + .024
      object.add(glyph)
      reactions.register(index, glyph, piece.icon === 'heart' ? bodyMaterial : undefined)
    }
    if (piece.artwork) {
      const faceGeometry = new THREE.PlaneGeometry(1.23, 1.23, 24, 24)
      const vertices = faceGeometry.getAttribute('position'), half = geometry.boundingBox!.max
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), y = vertices.getY(i)
        const z = half.z * Math.pow(Math.max(.001, 1 - Math.abs(x / half.x) ** 3.8 - Math.abs(y / half.y) ** 3.8), 1 / 3.8)
        vertices.setZ(i, z + .009)
      }
      faceGeometry.computeVertexNormals(); geometries.push(faceGeometry)
      const faceMaterial = new THREE.MeshPhysicalMaterial({ map: surfaces.face(piece.artwork), transparent: true, depthWrite: false, roughness: piece.artwork === 'poster' ? .58 : .26, metalness: 0, clearcoat: piece.artwork === 'poster' ? .1 : .65, clearcoatRoughness: .22, envMapIntensity: .35 })
      artworkMaterials.push(faceMaterial)
      const face = new THREE.Mesh(faceGeometry, faceMaterial)
      object.add(face)
      reactions.register(index, face)
    }
    if (piece.lettering) {
      const letterGeometry = new THREE.PlaneGeometry(1.1, 1.1)
      geometries.push(letterGeometry)
      const lettering = new THREE.Mesh(letterGeometry, createLetterMaterial(piece.lettering, piece.finish === 'coral'))
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
      body.rotation.copy(body.rest); body.previousRotation.copy(body.rest)
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
  const journey = createBalloonJourney(onJourney)
  const flight = createBalloonFlight()
  const solveBodyContacts = createBodyContacts()
  let flightScale = 1, flightPopped = false, flightContacts = 0, neighborMotion = 0
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
    // A different body can burst while the pointer is dragging this one.
    if (dragging === index) {
      dragging = -1; canClick = false
      cursor.classList.remove('is-dragging')
    }
    if (feedbackIndex === index) {
      cursor.classList.remove('is-charging')
      cursor.style.setProperty('--charge', '0')
    }
    if (import.meta.env.DEV) host.dataset.lastBurst = String(index)
  }, (index, body, generation) => {
    // Start fully outside the current viewport, at the ornament's natural side.
    const angle = Math.atan2(body.home.y, body.home.x || .01) + Math.sin(index * 2.4 + generation) * .32
    const x = Math.cos(angle), y = Math.sin(angle)
    const distance = Math.min((camera.right + body.radius * cluster.scale.x * 2) / Math.max(.001, Math.abs(x)), (camera.top + body.radius * cluster.scale.x * 2) / Math.max(.001, Math.abs(y)))
    offset.set(x * distance, y * distance, body.home.z * cluster.scale.x)
    cluster.worldToLocal(offset)
    body.position.copy(offset)
    if (index < COUNT) { body.rotation.copy(bodies[index].rest); bodies[index].previousRotation.copy(body.rotation) }
  }, index => reactions.scale(index), index => journey.state.phase !== 'idle' && index === journey.state.index ? flightScale : null)
  const flightStart = new THREE.Vector3(), flightTarget = new THREE.Vector3()
  let flightRadius = 1
  const beginJourney = (index: number) => {
    if (journey.state.phase !== 'idle' || !lifecycle.canGrab(index)) return
    const body = interactiveBodies[index]
    flightStart.copy(body.position); cluster.localToWorld(flightStart)
    flightRadius = baseRadii[index] * cluster.scale.x
    flightScale = 1; flightPopped = false; flightContacts = 0; neighborMotion = 0
    flight.start(body)
    journey.start(index, paused)
    active = false
    cursor.classList.remove('visible', 'is-dragging', 'is-charging')
    // Reduced motion skips the climb and bursts immediately at the destination.
    if (paused) {
      advanceJourney(STEP)
      lifecycle.step(STEP)
      body.position.copy(flightTarget); body.previous.copy(body.position)
      popJourney(); updateInstances()
    }
    needsRender = true
  }
  const advanceJourney = (dt: number) => {
    journey.step(dt)
    if (flightPopped || journey.state.phase === 'idle') return
    const { travel, rise, growth } = journey.state
    const viewHeight = camera.top - camera.bottom
    const destinationRadius = Math.max(flightRadius * 1.15, Math.min(viewHeight * .24, (camera.right - camera.left) * .28))
    flightScale = THREE.MathUtils.lerp(1, destinationRadius / flightRadius, growth)
    flightTarget.set(
      THREE.MathUtils.lerp(flightStart.x, 0, travel),
      THREE.MathUtils.lerp(flightStart.y, viewHeight, rise),
      flightStart.z,
    )
    cluster.worldToLocal(flightTarget)
    flight.aim(flightTarget, dt)
  }
  const popJourney = () => {
    if (journey.state.phase !== 'popped' || flightPopped) return
    flightPopped = true
    const index = journey.state.index, body = interactiveBodies[index]
    // Burst from the actual solved position and retain the balloon's upward momentum.
    burstEffects.burst({ position: body.position, radius: body.radius, baseRadius: baseRadii[index], halfSize: body.halfSize, rotation: body.rotation, velocity: body.velocity, shapePower: body.shapePower, finish: index < COUNT ? pieces[index].finish : 'bubble', isSphere: index >= COUNT })
    burstAudio.play(baseRadii[index], index >= COUNT)
    if (import.meta.env.DEV) host.dataset.journeyPopSpeed = body.velocity.y.toFixed(3)
    body.enabled = false
    flight.reset()
  }
  const updateJourney = () => {
    const { phase, index, growth } = journey.state
    const travel = journey.renderTravel(paused ? 1 : renderAlpha)
    const viewHeight = camera.top - camera.bottom
    camera.position.y = travel * viewHeight
    camera.updateMatrixWorld()
    const pageY = travel * host.clientHeight
    host.parentElement?.style.setProperty('--journey-y', `${pageY.toFixed(3)}px`)
    musicVisuals.setTravel(travel)
    host.dataset.journeyPhase = phase
    if (import.meta.env.DEV) {
      host.dataset.journeyTravel = travel.toFixed(4)
      host.dataset.journeyScreenOffset = pageY.toFixed(1)
      host.dataset.journeyBalloon = String(index)
      host.dataset.journeyPops = flightPopped ? '1' : '0'
      host.dataset.journeyScale = growth.toFixed(3)
      host.dataset.journeyContacts = String(flightContacts)
      host.dataset.journeyNeighborMotion = neighborMotion.toFixed(3)
      host.dataset.journeyBalloonEnabled = String(interactiveBodies[index].enabled !== false)
    }
    needsRender = true
  }
  const clearJourney = () => {
    flight.reset(); flightPopped = false; flightScale = 1
    journey.reset()
    camera.position.y = 0; camera.updateMatrixWorld()
    musicVisuals.setTravel(0)
    host.parentElement?.style.setProperty('--journey-y', '0px')
    host.dataset.journeyPhase = 'idle'
    for (const key of ['journeyTravel', 'journeyScreenOffset', 'journeyPops', 'journeyBalloon', 'journeyScale', 'journeyContacts', 'journeyNeighborMotion', 'journeyBalloonEnabled', 'journeyPopSpeed']) delete host.dataset[key]
  }
  const renderBodyRadiusAt = (index: number) => lifecycle.scale(index, renderAlpha)
  const bubbleRadiusAt = (index: number) => lifecycle.scale(COUNT + index, renderAlpha)
  let renderAlpha = 1

  const updateClusterTransform = (time: number) => {
    cluster.rotation.y = Math.sin(time * .14) * .025
    cluster.rotation.z = Math.sin(time * .2) * .014
    cluster.updateMatrixWorld(true)
  }
  const step = (dt: number, settling = false) => {
    elapsed += settling ? 0 : dt
    // Convert the flight target using the physics pose, never a stale render pose.
    updateClusterTransform(elapsed)
    if (!settling) {
      advanceJourney(dt)
      lifecycle.step(dt)
    }
    for (let i = 0; i < COUNT; i++) {
      const body = bodies[i]
      if (body.enabled === false) continue
      body.previousRotation.copy(body.rotation)
      if (!settling && flight.integrate(body, dt)) continue
      const { position: p, velocity: v, radius: r } = body
      body.previous.copy(p)
      // Gentle springs preserve the composition while every piece remains tangible.
      const float = settling ? 0 : Math.sin(elapsed * .65 + body.phase) * .11
      v.x += ((body.home.x - p.x) * 3.2 + float * .6) * dt
      v.y += ((body.home.y - p.y) * 3.8 + float) * dt
      v.z += (body.home.z - p.z) * 4.2 * dt

      if (!settling && i === dragging && !canClick) {
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

    const ascendingIndex = journey.state.phase !== 'idle' && !flightPopped ? journey.state.index : -1
    flightContacts += solveBodyContacts(bodies, ascendingIndex, ascendingIndex >= 0 ? 6 : 3)

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
    bubbleInteraction.dragging = dragging >= COUNT && !canClick ? dragging - COUNT : -1
    orbits.step(dt, bodies, elapsed, settling, bubbleInteraction, settling ? undefined : flight.integrate)
    if (ascendingIndex >= 0) {
      // Cable and bubble reactions can move tiles too. Finish with mutual contact
      // correction rather than overwriting the balloon's position with an animation.
      for (let i = 0; i < 3; i++) {
        flightContacts += solveBodyContacts(bodies, ascendingIndex, 2)
        orbits.solveContacts()
      }
      if (import.meta.env.DEV) interactiveBodies.forEach((body, i) => {
        if (i !== ascendingIndex && body.enabled !== false) neighborMotion += body.position.distanceTo(body.previous)
      })
    }
    if (!settling) { popJourney(); burstEffects.step(dt, interactiveBodies) }
  }

  const updateInstances = (alpha = 1) => {
    renderAlpha = alpha
    orbits.update(alpha, bubbleRadiusAt)
    updateClusterTransform(paused ? elapsed : Math.max(0, elapsed - STEP + alpha * STEP))
    bodies.forEach((body, i) => {
      body.object.visible = body.enabled !== false
      body.object.scale.setScalar(lifecycle.scale(i, alpha))
      body.object.position.lerpVectors(body.previous, body.position, alpha)
      body.object.quaternion.slerpQuaternions(body.previousRotation, body.rotation, alpha)
      offset.copy(body.object.position).applyMatrix4(cluster.matrixWorld)
      contactLighting.setSphere(i, offset, body.enabled === false ? 0 : body.radius * cluster.scale.x * .79)
    })
    contactLighting.update()
  }

  const reset = () => {
    clearJourney()
    dragging = -1
    canClick = false; feedbackIndex = -1
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
    if (paused || journey.state.phase !== 'idle') return
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
    cluster.scale.setScalar(mobile ? .82 : .9)
    cluster.position.x = mobile ? 0 : camera.right * .13
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
    if (journey.state.phase !== 'idle') return
    projectPointer(event)
    if (pointerId !== null && pressOrigin.distanceTo(cursorTarget) > 9) canClick = false
  }
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointerId !== null || journey.state.phase !== 'idle') return
    projectPointer(event)
    burstAudio.unlock()
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(interactiveMeshes, false).find(candidate => {
      const index = candidate.object === orbits.bubbleMesh ? COUNT + candidate.instanceId! : candidate.object.userData.bodyIndex as number
      const finish = index < COUNT ? pieces[index].finish : 'bubble'
      return entrance.hasEntered(index) && interactiveBodies[index].enabled !== false && warmedFinishes.has(finish) && lifecycle.canGrab(index)
    })
    dragging = -1; canClick = false
    if (hit) {
      dragging = hit.object === orbits.bubbleMesh ? COUNT + hit.instanceId! : hit.object.userData.bodyIndex as number
      dragDepth = interactiveBodies[dragging].position.z + .2
      projectPointer(event)
      pressOrigin.copy(cursorTarget)
      canClick = true
      pressTime = performance.now()
    }
    pointerId = event.pointerId
    host.setPointerCapture(event.pointerId)
    cursor.classList.add('is-dragging')
  }
  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    const clicked = dragging
    const isClick = canClick && clicked >= 0 && performance.now() - pressTime < 450 && pressOrigin.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) <= 9
    if (isClick) selectMusic(clicked)
    if (isClick) beginJourney(clicked)
    const releasedPointer = pointerId
    pointerId = null
    if (host.hasPointerCapture(releasedPointer)) host.releasePointerCapture(releasedPointer)
    dragging = -1
    canClick = false
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
    canClick = false
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
    if (index < COUNT) bodies[index].previousRotation.copy(body.rotation)
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
        host.dataset.physicsTime = elapsed.toFixed(3)
        host.dataset.fps = ((frameCount * 1000) / (now - sampleTime)).toFixed(0)
        host.dataset.drawCalls = String(renderer.info.render.calls)
        host.dataset.triangles = String(renderer.info.render.triangles)
        host.dataset.wireContacts = String(orbits.wire.contacts)
        host.dataset.ribbonContacts = String(orbits.ribbon.physics.contacts)
        host.dataset.soundPlays = String(burstAudio.plays)
        host.dataset.lastSound = burstAudio.lastSound
        frameCount = 0; sampleTime = now
      }
    }
    const sound = music.sample()
    if (reactions.update(dt, selectedMusic, musicState.audible, sound, paused)) needsRender = true
    const travelling = journey.state.phase !== 'idle'
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
    if (!travelling && paused && (needsRender || settleFrames > 0)) {
      if (settleFrames > 0) { for (let i = 0; i < 4; i++) step(STEP, true); settleFrames-- }
      orbits.rest()
      bodies.forEach(body => { body.previous.copy(body.position); body.previousRotation.copy(body.rotation) })
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
      cursor.classList.toggle('is-charging', charge > 0)
      cursor.style.setProperty('--charge', String(charge))
      if (import.meta.env.DEV) {
        host.dataset.wetDrops = String(burstEffects.surfaceDrops)
        host.dataset.oilStrands = String(burstEffects.oilStrands)
        host.dataset.liquidDrops = String(burstEffects.activeFragments)
        host.dataset.charging = String(feedbackIndex)
        host.dataset.bursts = String(lifecycle.pops)
        host.dataset.inflating = String(lifecycle.states.filter(state => state.phase === 'inflating').length)
        host.dataset.inflationPhase = feedbackIndex >= 0 ? lifecycle.states[feedbackIndex].phase : 'idle'
        host.dataset.inflationScale = feedbackIndex >= 0 ? lifecycle.states[feedbackIndex].scale.toFixed(3) : '1'
        host.dataset.charge = charge.toFixed(2)
        host.dataset.replacements = String(lifecycle.states.filter(state => state.phase === 'arriving').length)
      }
      needsRender = true
    }
    if (travelling) {
      if (paused && !flightPopped) {
        advanceJourney(STEP); lifecycle.step(STEP)
        const body = interactiveBodies[journey.state.index]
        body.position.copy(flightTarget); body.previous.copy(body.position)
        popJourney(); updateInstances()
      }
      updateJourney()
    }
    if (musicVisuals.update(dt, musicState.audible ? sound.energy : 0, paused)) needsRender = true
    host.parentElement?.style.setProperty('--music-energy', sound.energy.toFixed(3))
    if (import.meta.env.DEV) {
      host.dataset.musicEnergy = sound.energy.toFixed(4)
      host.dataset.musicContext = music.contextState
      host.dataset.musicStreams = String(music.streams)
      host.dataset.musicSource = music.source
      host.dataset.musicTime = music.time.toFixed(2)
      host.dataset.musicDuration = music.duration.toFixed(2)
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
    artworkMaterials.forEach(material => material.dispose())
    surfaces.dispose()
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
    selectTrack(mood) {
      if (musicState.mood === mood && selectedMusic >= 0) { music.toggle(); return }
      const index = mood === 'bubble' ? COUNT : pieces.findIndex(piece => piece.finish === mood)
      if (index >= 0) selectMusic(index)
    },
    setPaused(value) {
      paused = value; accumulator = 0; needsRender = true
      if (value) {
        journey.skipTravel()
        onCancel(); burstAudio.stop()
        // Pausing / reduced motion completes arrivals in place, never off-screen.
        interactiveBodies.forEach((body, index) => {
          if (journey.state.phase === 'idle' && entrance.hasEntered(index) && elapsed - arrivedAt[index] < 5) {
            body.position.copy(body.home); body.previous.copy(body.home); body.velocity.set(0, 0, 0)
            if (index < COUNT) { body.rotation.copy(bodies[index].rest); bodies[index].previousRotation.copy(body.rotation) }
          }
        })
        settleFrames = 24
      }
    },
    setSoundEnabled(value) { burstAudio.setMuted(!value); music.setMuted(!value) },
    dispose() {
      if (disposed) return
      disposed = true
      flight.reset()
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
