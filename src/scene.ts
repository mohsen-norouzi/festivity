import * as THREE from 'three'
import { makeMusicIcons, type MusicIcon } from './musicIcons'
import { createStudio } from './studio'
import { createContactLighting } from './contactLighting'

export interface OrnamentScene {
  dispose: () => void
  reset: () => void
  scatter: () => void
  setPaused: (paused: boolean) => void
}

interface Body {
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

type Finish = 'ink' | 'coral' | 'lilac' | 'pearl' | 'glass'
type Form = 'tile' | 'capsule' | 'ring' | 'disc'
interface Piece { p: [number, number, number]; r: number; finish: Finish; icon?: MusicIcon; form?: Form; tilt?: [number, number, number] }
const pieces: Piece[] = [
  { p: [-.1, .05, 2], r: 1.02, finish: 'ink', icon: 'play', tilt: [-.13, .23, -.25] },
  { p: [-2.02, .75, 1.28], r: .99, finish: 'glass', icon: 'wave', tilt: [-.15, -.22, -.22] },
  { p: [-1.35, -1.38, 1.9], r: 1.02, finish: 'coral', icon: 'note', tilt: [.12, -.25, .21] },
  { p: [2.65, -.9, 1.27], r: 1, finish: 'coral', icon: 'heart', tilt: [-.15, -.26, -.3] },
  { p: [1.25, 1.75, 1.15], r: .97, finish: 'glass', icon: 'note', tilt: [.12, -.21, .2] },
  { p: [1.46, -.12, 1.8], r: .96, finish: 'pearl', icon: 'headphones', tilt: [.12, .2, .15] },
  { p: [2.25, 1.05, -.05], r: 1.03, finish: 'lilac', icon: 'note', form: 'capsule', tilt: [.1, -.12, .07] },
  { p: [.88, -1.9, .94], r: .89, finish: 'glass', icon: 'pause', tilt: [.18, -.15, -.17] },
  { p: [-3.12, -.28, .78], r: .94, finish: 'ink', icon: 'note', tilt: [.1, .24, .16] },
  { p: [-2.57, -1.5, -.04], r: .93, finish: 'lilac', form: 'capsule', tilt: [.12, .23, -.24] },
  { p: [-2.62, 1.25, -.48], r: .85, finish: 'coral', icon: 'wave', tilt: [.14, -.3, .12] },
  { p: [-.88, 1.75, -.02], r: .93, finish: 'ink', icon: 'note', tilt: [.1, -.2, -.31] },
  { p: [.04, 2.58, -.53], r: .66, finish: 'coral', icon: 'wave', tilt: [.1, -.27, .13] },
  { p: [-1.62, 2.25, -.68], r: .7, finish: 'pearl', icon: 'pause', tilt: [.1, .3, -.36] },
  { p: [3.29, .17, -.15], r: .85, finish: 'ink', icon: 'note', tilt: [-.16, .2, -.22] },
  { p: [3.6, -.6, -.94], r: .82, finish: 'glass', icon: 'wave', tilt: [.18, -.24, -.3] },
  { p: [-.13, -1.92, -.39], r: .83, finish: 'ink', icon: 'note', tilt: [.2, .2, .47] },
  { p: [-1.26, -2.32, -.75], r: .69, finish: 'pearl', icon: 'wave', tilt: [.2, .1, .4] },
  { p: [-3.2, -1.48, -.95], r: .83, finish: 'coral', icon: 'play', tilt: [.3, .1, .66] },
  { p: [-.35, .1, -.72], r: .99, finish: 'coral', icon: 'note', tilt: [.1, .2, -.1] },
  { p: [1.1, -.95, -.7], r: .88, finish: 'lilac', form: 'ring', tilt: [.1, -.35, .1] },
  { p: [2.1, -1.9, -.87], r: .85, finish: 'ink', form: 'capsule', tilt: [.3, .2, -.2] },
  { p: [-2, -.3, -.8], r: .83, finish: 'lilac', form: 'ring', tilt: [.1, -.3, .4] },
  { p: [2.8, 1.75, -.9], r: .71, finish: 'pearl', form: 'ring', tilt: [.3, .4, -.25] },
  { p: [-.53, .72, 1.46], r: .44, finish: 'lilac', tilt: [.3, .4, .4] },
  { p: [-4.35, 1.12, .08], r: .3, finish: 'ink', tilt: [.3, .4, .65] },
  { p: [-4.72, -.12, -.15], r: .24, finish: 'lilac', tilt: [.15, .5, -.35] },
  { p: [-3.95, -1.82, .03], r: .2, finish: 'coral', form: 'disc' },
  { p: [4.5, .9, -.2], r: .33, finish: 'ink', icon: 'pause', tilt: [.3, .3, -.5] },
  { p: [3.72, 1.79, .25], r: .29, finish: 'pearl', tilt: [.2, .35, .35] },
  { p: [4.38, -1.39, .1], r: .27, finish: 'lilac', tilt: [.2, -.4, -.3] },
  { p: [2.15, 2.5, -.34], r: .21, finish: 'coral', tilt: [.1, .2, -.2] },
  { p: [-.1, -2.95, -.3], r: .31, finish: 'pearl', tilt: [.3, .3, -.5] },
  { p: [-2.51, -2.69, .1], r: .23, finish: 'pearl', form: 'disc' },
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
  const finishes: Record<Finish, THREE.MeshPhysicalMaterial> = {
    ink: new THREE.MeshPhysicalMaterial({ color: '#121524', roughness: .36, metalness: .1, clearcoat: .16, clearcoatRoughness: .38, envMapIntensity: .85 }),
    coral: new THREE.MeshPhysicalMaterial({ color: '#ee8a81', roughness: .35, metalness: .025, clearcoat: .45, clearcoatRoughness: .33, envMapIntensity: .85 }),
    lilac: new THREE.MeshPhysicalMaterial({ color: '#a581d6', roughness: .34, metalness: .07, clearcoat: .35, clearcoatRoughness: .34, envMapIntensity: .9 }),
    pearl: new THREE.MeshPhysicalMaterial({ color: '#eee4e1', roughness: .32, metalness: .035, clearcoat: .45, clearcoatRoughness: .28, envMapIntensity: .8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#fff0ed', roughness: .16, metalness: 0, transmission: .96, thickness: 1.05, ior: 1.46, clearcoat: .7, clearcoatRoughness: .23, attenuationColor: '#c59ad5', attenuationDistance: 7, envMapIntensity: 1.1 }),
  }
  const contactLighting = createContactLighting(COUNT)
  Object.entries(finishes).forEach(([name, material]) => {
    material.dithering = true
    if (name !== 'glass') contactLighting.apply(material)
  })
  const glyphDark = new THREE.MeshPhysicalMaterial({ color: '#171c32', metalness: .32, roughness: .3, clearcoat: .3, dithering: true, transparent: true })
  const glyphLight = new THREE.MeshPhysicalMaterial({ color: '#f8e9ef', metalness: .13, roughness: .28, clearcoat: .4, dithering: true, transparent: true })
  const glyphLilac = new THREE.MeshPhysicalMaterial({ color: '#b5a7e8', metalness: .3, roughness: .3, clearcoat: .3, dithering: true, transparent: true })
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
    tile: pillow(1.55, 1.55, 1.3, 3.6),
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
  const smallTile = pillow(1.55, 1.55, 1.3, 3.6, 12)
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
      const material = piece.finish === 'ink' ? glyphLilac : piece.finish === 'pearl' || piece.finish === 'glass' ? glyphDark : glyphLight
      const glyphGeometry = icons[piece.icon].clone()
      const glyph = new THREE.Mesh(glyphGeometry, material)
      geometries.push(glyphGeometry)
      glyph.scale.setScalar(piece.form === 'capsule' ? .82 : .96)
      glyph.position.z = geometry.boundingBox!.max.z + .014
      object.add(glyph)
    }
    object.scale.setScalar(piece.r)
    cluster.add(object)
    const home = new THREE.Vector3(...piece.p)
    if (index < 25) { home.x *= .92; home.y *= .85; home.z *= 1.18 }
    const rest = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(piece.tilt ?? [.2, .2, .2])))
    bodies.push({ home, rest, object, position: home.clone(), previous: home.clone(), velocity: new THREE.Vector3(), rotation: rest.clone(), spin: new THREE.Vector3(), radius: piece.r, mass: piece.r ** 3, phase: random() * Math.PI * 2 })
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
  }

  const updateInstances = (alpha = 1) => {
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
    for (let i = 0; i < 240; i++) step(STEP, true)
    for (const body of bodies) { body.velocity.set(0, 0, 0); body.previous.copy(body.position) }
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
    const viewHeight = mobile ? Math.max(8.2, 8.8 / aspect) : Math.max(8.5, 13.8 / aspect)
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
      glyphDark.dispose(); glyphLight.dispose(); glyphLilac.dispose(); studio.dispose()
      contactLighting.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      cursor.classList.remove('visible', 'is-dragging')
    },
  }
}
