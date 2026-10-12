import * as THREE from 'three'
import { makeMusicIcons, type MusicIcon } from './musicIcons'
import { createStudio } from './studio'
import { createOrbits } from './orbits'
import { createContactLighting } from './contactLighting'

export interface OrnamentScene {
  dispose: () => void
  reset: () => void
  scatter: () => void
  setPaused: (paused: boolean) => void
}

interface Body {
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
type Form = 'tile' | 'capsule' | 'ring' | 'disc'
interface Piece { p: [number, number, number]; r: number; finish: Finish; icon?: MusicIcon; lettering?: boolean; form?: Form; tilt?: [number, number, number] }
const pieces: Piece[] = [
  { p: [-.46, .22, 2.8], r: 1.38, finish: 'glass', icon: 'wave', tilt: [.12, -.22, .24] },
  { p: [-2.22, .6, 1.83], r: 1.01, finish: 'pearl', icon: 'pause', tilt: [.16, .22, -.25] },
  { p: [-1.3, 1.86, .65], r: 1.01, finish: 'ink', icon: 'note', tilt: [.12, -.23, -.32] },
  { p: [.61, -1.45, 2.31], r: 1.02, finish: 'coral', icon: 'heart', tilt: [.15, .2, -.23] },
  { p: [1.24, 1.7, .9], r: .94, finish: 'pearl', icon: 'wave', tilt: [.17, -.15, .2] },
  { p: [1.62, .22, 2.05], r: .92, finish: 'glass', icon: 'headphones', tilt: [.12, -.32, .23] },
  { p: [2.89, -.28, 1.37], r: 1.04, finish: 'ink', lettering: true, tilt: [.15, -.23, .3] },
  { p: [2.32, -1.85, 1.02], r: .98, finish: 'blue', icon: 'cloud', tilt: [.12, -.25, .22] },
  { p: [-2.24, -1.1, 1.3], r: .88, finish: 'ink', icon: 'globe', tilt: [.14, .15, -.25] },
  { p: [-1.15, -2.03, 1.7], r: .7, finish: 'glass', icon: 'sparkle', tilt: [.13, .2, -.3] },
  { p: [-3.06, -.1, -.4], r: .92, finish: 'lilac', form: 'capsule', tilt: [.25, .22, -.12] },
  { p: [.05, 2.44, -.4], r: .7, finish: 'coral', icon: 'sparkle', tilt: [.2, -.2, .28] },
  { p: [2.3, 1.62, -.65], r: .86, finish: 'ink', tilt: [.2, .4, .28] },
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
export function createOrnamentScene(host: HTMLDivElement, cursor: HTMLDivElement, onReady: () => void, onError: () => void): OrnamentScene {
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
  const orbits = createOrbits(cluster)
  const finishes: Record<Finish, THREE.MeshPhysicalMaterial> = {
    ink: new THREE.MeshPhysicalMaterial({ color: '#101421', roughness: .32, metalness: .08, clearcoat: .32, clearcoatRoughness: .32, envMapIntensity: .9 }),
    coral: new THREE.MeshPhysicalMaterial({ color: '#f18f86', roughness: .28, metalness: 0, clearcoat: .62, clearcoatRoughness: .25, envMapIntensity: .9 }),
    lilac: new THREE.MeshPhysicalMaterial({ color: '#af8aca', roughness: .29, metalness: .03, clearcoat: .45, clearcoatRoughness: .3, envMapIntensity: 1 }),
    blue: new THREE.MeshPhysicalMaterial({ color: '#758ad1', roughness: .27, metalness: .035, clearcoat: .55, clearcoatRoughness: .28, envMapIntensity: .95 }),
    pearl: new THREE.MeshPhysicalMaterial({ color: '#f1deda', roughness: .3, metalness: 0, clearcoat: .42, clearcoatRoughness: .26, envMapIntensity: .85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#fff4fc', roughness: .18, metalness: 0, transmission: .94, thickness: .8, ior: 1.46, clearcoat: .85, clearcoatRoughness: .26, attenuationColor: '#cfaae9', attenuationDistance: 6, envMapIntensity: 1.1 }),
  }
  const contactLighting = createContactLighting(COUNT)
  Object.entries(finishes).forEach(([name, material]) => {
    material.dithering = true
    if (name !== 'glass') contactLighting.apply(material)
  })
  // Transparent render queue excludes symbols from the glass refraction buffer.
  const glyphDark = new THREE.MeshPhysicalMaterial({ color: '#192034', metalness: .2, roughness: .33, clearcoat: .22, dithering: true, transparent: true })
  const glyphLight = new THREE.MeshPhysicalMaterial({ color: '#fff0f5', metalness: .08, roughness: .25, clearcoat: .45, dithering: true, transparent: true })
  const glyphLilac = new THREE.MeshPhysicalMaterial({ color: '#d8bde9', metalness: .25, roughness: .3, clearcoat: .3, dithering: true, transparent: true })
  const glyphPrism = new THREE.MeshPhysicalMaterial({ color: '#f5dbff', metalness: .2, roughness: .2, clearcoat: .7, emissive: '#a76fe0', emissiveIntensity: .12, dithering: true, transparent: true })
  const letterCanvas = document.createElement('canvas')
  letterCanvas.width = letterCanvas.height = 512
  const letterContext = letterCanvas.getContext('2d')!
  letterContext.fillStyle = '#e0c9f0'
  letterContext.textAlign = 'center'
  letterContext.font = '500 43px Arial, sans-serif'
  letterContext.letterSpacing = '5px'
  ;['CREATE', 'CONNECT', 'GROW'].forEach((line, i) => letterContext.fillText(line, 256, 191 + i * 65))
  const letterTexture = new THREE.CanvasTexture(letterCanvas)
  letterTexture.colorSpace = THREE.SRGBColorSpace
  letterTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const letterMaterial = new THREE.MeshBasicMaterial({ map: letterTexture, transparent: true, depthWrite: false, toneMapped: false })
  const icons = makeMusicIcons()
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
    ring: new THREE.TorusGeometry(.64, .26, 24, 64),
    disc: new THREE.SphereGeometry(.8, 40, 24),
  }
  prototypes.disc.scale(1, 1, .52)
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
  const meshes: THREE.Mesh[] = []
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
  const cursorPosition = new THREE.Vector2(-100, -100)
  const cursorTarget = new THREE.Vector2(-100, -100)
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
  let needsRender = true
  let mobile = false
  let frameCount = 0
  let sampleTime = 0

  pieces.forEach((piece, index) => {
    const geometry = (piece.r < .5 && !piece.form ? smallTile : prototypes[piece.form ?? 'tile']).clone()
    geometry.setAttribute('shapeIndex', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(index), 1))
    geometries.push(geometry)
    const object = new THREE.Group()
    const mesh = new THREE.Mesh(geometry, finishes[piece.finish])
    mesh.userData.bodyIndex = index
    object.add(mesh)
    meshes.push(mesh)
    if (piece.icon) {
      const material = piece.finish === 'glass' ? glyphPrism : piece.finish === 'ink' ? glyphLilac : piece.finish === 'pearl' ? glyphDark : glyphLight
      const glyphGeometry = icons[piece.icon].clone()
      const glyph = new THREE.Mesh(glyphGeometry, material)
      geometries.push(glyphGeometry)
      glyph.scale.setScalar(index === 0 ? 1.06 : .84)
      glyph.position.z = geometry.boundingBox!.max.z + .024
      object.add(glyph)
    }
    if (piece.lettering) {
      const letterGeometry = new THREE.PlaneGeometry(1.1, 1.1)
      geometries.push(letterGeometry)
      const lettering = new THREE.Mesh(letterGeometry, letterMaterial)
      lettering.position.z = geometry.boundingBox!.max.z + .012
      object.add(lettering)
    }
    object.scale.setScalar(piece.r)
    cluster.add(object)
    const home = new THREE.Vector3(...piece.p)
    if (index < 22) { home.x *= .94; home.y *= .9; home.z *= 1.1 }
    const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(piece.tilt ?? [.2, .2, .2])))
    bodies.push({ halfSize: geometry.boundingBox!.max.clone().multiplyScalar(piece.r), shapePower: piece.form === 'capsule' ? 2.8 : 3.8, home, rest, object, position: home.clone(), previous: home.clone(), velocity: new THREE.Vector3(), rotation: rest.clone(), spin: new THREE.Vector3(), radius: piece.r, mass: piece.r ** 3, phase: random() * Math.PI * 2 })
  })

  const fillBodies = () => {
    random = randomGenerator(2017)
    bodies.forEach(body => {
      body.position.copy(body.home); body.previous.copy(body.home)
      body.velocity.set(0, 0, 0); body.spin.set(0, 0, 0)
      body.rotation.copy(body.rest)
    })
  }

  const step = (dt: number, settling = false) => {
    elapsed += settling ? 0 : dt
    for (let i = 0; i < COUNT; i++) {
      const body = bodies[i]
      const { position: p, velocity: v, radius: r } = body
      body.previous.copy(p)
      // Gentle springs preserve the composition while every piece remains tangible.
      const float = settling ? 0 : Math.sin(elapsed * .65 + body.phase) * .11
      v.x += ((body.home.x - p.x) * 3.2 + float * .6) * dt
      v.y += ((body.home.y - p.y) * 3.8 + float) * dt
      v.z += (body.home.z - p.z) * 4.2 * dt

      if (!settling && i === dragging) {
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
      v.multiplyScalar(Math.exp(-(settling ? 3.2 : 1.75) * dt))
      v.clampLength(0, 13)
      p.addScaledVector(v, dt)
    }

    // Sequential impulses with mass-weighted positional correction keep surfaces touching.
    for (let iteration = 0; iteration < 3; iteration++) {
      for (let i = 0; i < COUNT; i++) {
        const a = bodies[i]
        for (let j = i + 1; j < COUNT; j++) {
          const b = bodies[j]
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
    orbits.wire.step(dt, bodies, elapsed, settling)
  }

  const updateInstances = (alpha = 1) => {
    orbits.update(elapsed, alpha)
    cluster.rotation.y = Math.sin(elapsed * .14) * .025
    cluster.rotation.z = Math.sin(elapsed * .2) * .014
    cluster.updateMatrixWorld(true)
    bodies.forEach((body, i) => {
      body.object.position.lerpVectors(body.previous, body.position, alpha)
      body.object.quaternion.copy(body.rotation)
      offset.copy(body.object.position).applyMatrix4(cluster.matrixWorld)
      contactLighting.setSphere(i, offset, body.radius * cluster.scale.x * .79)
    })
    contactLighting.update()
  }

  const reset = () => {
    dragging = -1
    active = false
    cursor.classList.remove('is-dragging')
    elapsed = 0
    fillBodies()
    orbits.wire.reset()
    for (let i = 0; i < 240; i++) step(STEP, true)
    for (const body of bodies) { body.velocity.set(0, 0, 0); body.previous.copy(body.position) }
    orbits.wire.rest()
    updateInstances()
    needsRender = true
  }

  const scatter = () => {
    if (paused) return
    for (const body of bodies) {
      delta.copy(body.position).normalize()
      body.velocity.addScaledVector(delta, 4 + random() * 3)
      body.spin.add(new THREE.Vector3(random() - .5, random() - .5, random() - .5).multiplyScalar(3))
    }
  }

  const resize = () => {
    const { width, height } = host.getBoundingClientRect()
    if (!width || !height) return
    const aspect = width / height
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

  const onMove = (event: PointerEvent) => projectPointer(event)
  const onDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointerId !== null) return
    projectPointer(event)
    if (paused) return
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(meshes, false)[0]
    if (hit) {
      dragging = hit.object.userData.bodyIndex as number
      dragDepth = bodies[dragging].position.z + .2
    }
    pointerId = event.pointerId
    host.setPointerCapture(event.pointerId)
    cursor.classList.add('is-dragging')
  }
  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
    pointerId = null
    dragging = -1
    cursor.classList.remove('is-dragging')
    if (event.pointerType === 'touch') active = false
  }
  const onLeave = () => {
    if (pointerId !== null) return
    active = false
    cursor.classList.remove('visible')
  }
  const onCancel = () => {
    dragging = -1; pointerId = null; active = false
    cursor.classList.remove('visible', 'is-dragging')
  }
  const onVisibility = () => { previousTime = 0; accumulator = 0 }
  const onContextLost = (event: Event) => { event.preventDefault(); onError() }
  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerdown', onDown)
  host.addEventListener('pointerup', onUp)
  host.addEventListener('pointercancel', onCancel)
  host.addEventListener('lostpointercapture', onCancel)
  host.addEventListener('pointerleave', onLeave)
  renderer.domElement.addEventListener('webglcontextlost', onContextLost)
  document.addEventListener('visibilitychange', onVisibility)

  reset()
  resize()

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
        frameCount = 0; sampleTime = now
      }
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
      needsRender = true
    }
    if (needsRender) {
      renderer.render(scene, camera)
      needsRender = false
    }
    if (!hasRendered) { hasRendered = true; onReady() }
  }
  raf = requestAnimationFrame(tick)

  return {
    reset, scatter,
    setPaused(value) { paused = value; accumulator = 0; needsRender = true },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onCancel)
      host.removeEventListener('lostpointercapture', onCancel)
      host.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      geometries.forEach(geometry => geometry.dispose())
      Object.values(prototypes).forEach(geometry => geometry.dispose())
      smallTile.dispose()
      Object.values(icons).forEach(geometry => geometry.dispose())
      Object.values(finishes).forEach(material => material.dispose())
      glyphDark.dispose(); glyphLight.dispose(); glyphLilac.dispose(); glyphPrism.dispose()
      letterMaterial.dispose(); letterTexture.dispose(); orbits.dispose(); studio.dispose()
      contactLighting.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      cursor.classList.remove('visible', 'is-dragging')
    },
  }
}
