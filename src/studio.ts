import * as THREE from 'three'

export function createStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const studio = new THREE.Scene()
  studio.background = new THREE.Color('#0c1014')
  const panelGeometry = new THREE.PlaneGeometry(1, 1)
  const panels: THREE.MeshBasicMaterial[] = []
  const lightCanvas = document.createElement('canvas')
  lightCanvas.width = lightCanvas.height = 128
  const lightContext = lightCanvas.getContext('2d')!
  const feather = lightContext.createRadialGradient(64, 64, 4, 64, 64, 64)
  feather.addColorStop(0, 'rgba(255,255,255,1)')
  feather.addColorStop(.5, 'rgba(255,255,255,.9)')
  feather.addColorStop(.8, 'rgba(255,255,255,.35)')
  feather.addColorStop(1, 'rgba(255,255,255,0)')
  lightContext.fillStyle = feather
  lightContext.fillRect(0, 0, 128, 128)
  const softbox = new THREE.CanvasTexture(lightCanvas)

  const panel = (color: string, intensity: number, position: number[], scale: number[]) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), map: softbox, transparent: true, side: THREE.DoubleSide, toneMapped: false })
    const mesh = new THREE.Mesh(panelGeometry, material)
    mesh.position.set(position[0], position[1], position[2])
    mesh.scale.set(scale[0], scale[1], 1)
    mesh.lookAt(0, 0, 0)
    studio.add(mesh)
    panels.push(material)
  }
  panel('#ffdecb', 9, [-3, 5, 2], [5, 4])
  panel('#a5c5e0', 7, [4, 2, 1], [3, 6])
  panel('#ff531b', 19, [-4, -2, 1], [3, 7])
  panel('#d65895', 7, [1, 5, -4], [5, 2])
  panel('#f77632', 7, [0, -4, 2], [5, 1])
  const generator = new THREE.PMREMGenerator(renderer)
  const environment = generator.fromScene(studio, .025)
  scene.environment = environment.texture
  scene.environmentIntensity = .72
  generator.dispose()
  panelGeometry.dispose()
  softbox.dispose()
  panels.forEach(material => material.dispose())

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  const background = new THREE.CanvasTexture(canvas)
  background.colorSpace = THREE.SRGBColorSpace
  scene.background = background
  let aspect = 16 / 9, disposed = false, loaded = false
  const photo = new Image()
  const paint = () => {
    // Canvas dimensions may change at a breakpoint; release the old GPU storage.
    background.dispose()
    canvas.width = aspect >= 1 ? 1920 : Math.round(1200 * aspect)
    canvas.height = aspect >= 1 ? Math.round(1920 / aspect) : 1200
    context.fillStyle = '#0d1115'; context.fillRect(0, 0, canvas.width, canvas.height)
    if (loaded) {
      const scale = Math.max(canvas.width / photo.width, canvas.height / photo.height)
      context.filter = 'blur(.7px)'
      context.drawImage(photo, (canvas.width - photo.width * scale) * (aspect < 1 ? .38 : .5), (canvas.height - photo.height * scale) / 2, photo.width * scale, photo.height * scale)
      context.filter = 'none'
      context.fillStyle = 'rgba(5,7,9,.17)'; context.fillRect(0, 0, canvas.width, canvas.height)
    }
    const shade = context.createLinearGradient(0, 0, 0, canvas.height)
    shade.addColorStop(0, 'rgba(4,6,8,.25)'); shade.addColorStop(.2, 'rgba(4,6,8,0)')
    shade.addColorStop(.73, 'rgba(4,6,8,0)'); shade.addColorStop(1, 'rgba(4,6,8,.68)')
    context.fillStyle = shade; context.fillRect(0, 0, canvas.width, canvas.height)
    background.needsUpdate = true
  }
  photo.onload = () => { if (!disposed) { loaded = true; paint() } }
  photo.src = '/textures/underground-club.webp'
  paint()

  scene.add(new THREE.HemisphereLight('#b8c4cc', '#341810', .35))
  const key = new THREE.DirectionalLight('#ffe0c9', 2.1)
  key.position.set(-3, 5, 4); scene.add(key)
  const cool = new THREE.DirectionalLight('#a9c8e0', 1.2)
  cool.position.set(4, 2, 2); scene.add(cool)
  const bounce = new THREE.DirectionalLight('#ff501b', 2.3)
  bounce.position.set(-4, -3, 1); scene.add(bounce)
  return { background, resize(nextAspect: number) { if (Math.abs(aspect - nextAspect) > .001) { aspect = nextAspect; paint() } }, dispose() { disposed = true; photo.onload = null; environment.dispose(); background.dispose() } }
}
