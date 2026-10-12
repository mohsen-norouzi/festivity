import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'

export interface OrnamentScene {
  dispose: () => void
  reset: () => void
  scatter: () => void
  setPaused: (paused: boolean) => void
}

interface Body {
  position: THREE.Vector3
  previous: THREE.Vector3
  velocity: THREE.Vector3
  rotation: THREE.Quaternion
  spin: THREE.Vector3
  radius: number
  mass: number
  phase: number
}

const COUNT = 68
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
  const renderer = new THREE.WebGLRenderer({ alpha: true, premultipliedAlpha: false, antialias: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-6, 6, 3.5, -3.5, .1, 60)
  camera.position.set(0, 0, 20)
  camera.lookAt(0, 0, 0)
  const cluster = new THREE.Group()
  scene.add(cluster)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, .035)
  scene.environment = environment.texture
  scene.environmentIntensity = .62
  room.dispose()
  pmrem.dispose()

  scene.add(new THREE.HemisphereLight(0xfff9f5, 0xff8e91, 1.6))
  const key = new THREE.DirectionalLight(0xfffaf4, 4.2)
  key.position.set(-3, 6, 4)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffabb1, 1.25)
  fill.position.set(4, -2, 2)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xffffff, 1.3)
  rim.position.set(2, 4, -4)
  scene.add(rim)

  const pink = new THREE.MeshPhysicalMaterial({
    color: 0xffb2b8, roughness: .54, metalness: 0,
    clearcoat: .035, clearcoatRoughness: .45, envMapIntensity: .6, specularIntensity: .55,
  })
  const gold = new THREE.MeshStandardMaterial({ color: 0xd7a573, metalness: .88, roughness: .27, envMapIntensity: 1.4 })
  const sphereGeometry = new THREE.SphereGeometry(1, 40, 28)
  const capGeometry = new THREE.CylinderGeometry(.13, .165, .13, 32, 1)
  // Shallow radial flutes catch the studio reflections like stamped metal.
  const capPositions = capGeometry.getAttribute('position')
  for (let i = 0; i < capPositions.count; i++) {
    const x = capPositions.getX(i), z = capPositions.getZ(i)
    const scale = 1 + .07 * Math.cos(Math.atan2(z, x) * 16)
    capPositions.setX(i, x * scale)
    capPositions.setZ(i, z * scale)
  }
  capGeometry.computeVertexNormals()
  const lipGeometry = new THREE.TorusGeometry(.135, .015, 6, 32)
  lipGeometry.rotateX(Math.PI / 2)
  const loopGeometry = new THREE.TorusGeometry(.083, .018, 8, 28)
  const balls = new THREE.InstancedMesh(sphereGeometry, pink, COUNT)
  const caps = new THREE.InstancedMesh(capGeometry, gold, COUNT)
  const lips = new THREE.InstancedMesh(lipGeometry, gold, COUNT)
  const loops = new THREE.InstancedMesh(loopGeometry, gold, COUNT)
  const meshes = [balls, caps, lips, loops]
  meshes.forEach(mesh => {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    cluster.add(mesh)
  })

  const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer, renderTarget)
  const renderPass = new RenderPass(scene, camera)
  const ao = new GTAOPass(scene, camera, 1, 1)
  ao.updateGtaoMaterial({ radius: .8, thickness: 1.6, distanceExponent: 1.4, scale: 1, samples: 16 })
  ao.updatePdMaterial({ radius: 5, samples: 12, depthPhi: 4, normalPhi: 3 })
  ao.blendIntensity = .85
  // Warm occlusion suggests the diffuse pink bounce light between adjacent ornaments.
  ao.blendMaterial.fragmentShader = ao.blendMaterial.fragmentShader.replace(
    'mix(vec3(1.), texel.rgb, intensity)',
    'mix(vec3(1.), pow(max(texel.rgb, vec3(0.001)), vec3(0.45, 1.1, 1.0)), intensity)',
  )
  const antialias = new ShaderPass(FXAAShader)
  const output = new OutputPass()
  // Resolve coverage before tone mapping so transparent MSAA edges have no white halo.
  output.material.fragmentShader = output.material.fragmentShader.replace(
    'gl_FragColor = texture2D( tDiffuse, vUv );',
    'gl_FragColor = texture2D( tDiffuse, vUv ); if (gl_FragColor.a > 0.0001) gl_FragColor.rgb /= gl_FragColor.a;',
  )
  composer.addPass(renderPass)
  composer.addPass(ao)
  composer.addPass(antialias)
  composer.addPass(output)

  let random = randomGenerator(2017)
  const bodies: Body[] = []
  const matrix = new THREE.Matrix4()
  const localMatrix = new THREE.Matrix4()
  const offset = new THREE.Vector3()
  const size = new THREE.Vector3()
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

  const fillBodies = () => {
    bodies.length = 0
    random = randomGenerator(2017)
    for (let i = 0; i < COUNT; i++) {
      const radius = .33 + Math.pow(random(), .62) * .32
      const position = new THREE.Vector3((random() - .5) * 7.5, (random() - .5) * 3.2, (random() - .5) * 2.7)
      const axis = new THREE.Vector3(random() - .5, random() - .5, random() - .5).normalize()
      bodies.push({
        position, previous: position.clone(), velocity: new THREE.Vector3(),
        rotation: new THREE.Quaternion().setFromAxisAngle(axis, random() * Math.PI * 2),
        spin: new THREE.Vector3((random() - .5) * .2, (random() - .5) * .2, (random() - .5) * .2),
        radius, mass: radius ** 3, phase: random() * Math.PI * 2,
      })
      balls.setColorAt(i, new THREE.Color().setHSL(.003 + random() * .006, .72 + random() * .12, .9 + random() * .035))
    }
    if (balls.instanceColor) balls.instanceColor.needsUpdate = true
  }

  const step = (dt: number, settling = false) => {
    elapsed += settling ? 0 : dt
    for (let i = 0; i < COUNT; i++) {
      const body = bodies[i]
      const { position: p, velocity: v, radius: r } = body
      body.previous.copy(p)
      // A flatter ellipsoid reproduces the broad, floating composition.
      v.x += (-p.x * 1.05 + (settling ? 0 : p.z * .25)) * dt
      v.y += (-p.y * 4.05 + Math.sin(elapsed * .7 + body.phase) * .16) * dt
      v.z += (-p.z * 4.2 - (settling ? 0 : p.x * .16)) * dt

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
          const minDistance = (a.radius + b.radius) * .998
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
        body.spin.multiplyScalar(Math.exp(-.35 * dt))
        angularAxis.set(body.spin.x + .045, body.spin.y + .08, body.spin.z + .025)
        const speed = angularAxis.length()
        quaternion.setFromAxisAngle(angularAxis.multiplyScalar(1 / speed), speed * dt)
        body.rotation.premultiply(quaternion).normalize()
      }
    }
  }

  const updateInstances = (alpha = 1) => {
    bodies.forEach((body, i) => {
      offset.lerpVectors(body.previous, body.position, alpha)
      size.setScalar(body.radius)
      matrix.compose(offset, body.rotation, size)
      balls.setMatrixAt(i, matrix)
      localMatrix.makeTranslation(0, 1.01, 0)
      caps.setMatrixAt(i, localMatrix.premultiply(matrix))
      localMatrix.makeTranslation(0, 1.078, 0)
      lips.setMatrixAt(i, localMatrix.premultiply(matrix))
      localMatrix.makeTranslation(0, 1.14, 0)
      loops.setMatrixAt(i, localMatrix.premultiply(matrix))
    })
    meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true })
    cluster.rotation.z = Math.sin(elapsed * .22) * .035
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
    const viewHeight = mobile ? Math.max(7.8, 7.6 / aspect) : Math.max(6.9, 11.8 / aspect)
    camera.left = -viewHeight * aspect / 2
    camera.right = viewHeight * aspect / 2
    camera.top = viewHeight / 2
    camera.bottom = -viewHeight / 2
    camera.updateProjectionMatrix()
    cluster.scale.setScalar(mobile ? .82 : 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35))
    renderer.setSize(width, height)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(width, height)
    ao.setSize(Math.round(width * renderer.getPixelRatio() * .6), Math.round(height * renderer.getPixelRatio() * .6))
    antialias.uniforms.resolution.value.set(1 / (width * renderer.getPixelRatio()), 1 / (height * renderer.getPixelRatio()))
    needsRender = true
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)

  const projectPointer = (event: PointerEvent) => {
    const rect = host.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    cursorTarget.set(event.clientX, event.clientY)
    offset.set(pointer.x, pointer.y, 0).unproject(camera)
    offset.z = dragging >= 0 ? dragDepth : 1.35
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
    balls.computeBoundingSphere()
    const hit = raycaster.intersectObject(balls, false)[0]
    if (hit && hit.instanceId !== undefined) {
      dragging = hit.instanceId
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
    if (needsRender) { composer.render(); needsRender = false }
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
      sphereGeometry.dispose(); capGeometry.dispose(); lipGeometry.dispose(); loopGeometry.dispose()
      pink.dispose(); gold.dispose(); environment.dispose()
      meshes.forEach(mesh => mesh.dispose())
      ao.dispose(); antialias.dispose(); output.dispose(); renderPass.dispose(); composer.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      cursor.classList.remove('visible', 'is-dragging')
    },
  }
}
