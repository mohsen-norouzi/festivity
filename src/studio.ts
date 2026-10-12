import * as THREE from 'three'

export function createStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const studio = new THREE.Scene()
  studio.background = new THREE.Color('#373448')
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
  panel('#fff2e5', 12, [-4, 5, 4], [8, 6])
  panel('#d6c1ff', 8, [4, 2, 3], [4, 7])
  panel('#ffac80', 14, [-4, -3, 2], [7, 4])
  panel('#f7ecff', 4, [0, 5, -4], [6, 2])
  panel('#899eff', 3, [4, -1, -3], [2, 5])
  const generator = new THREE.PMREMGenerator(renderer)
  const environment = generator.fromScene(studio, .025)
  scene.environment = environment.texture
  scene.environmentIntensity = .8
  generator.dispose()
  panelGeometry.dispose()
  softbox.dispose()
  panels.forEach(material => material.dispose())

  const canvas = document.createElement('canvas')
  canvas.width = 1536; canvas.height = 1024
  const context = canvas.getContext('2d')!
  const base = context.createLinearGradient(0, 900, 1430, 50)
  base.addColorStop(0, '#ffb6ba')
  base.addColorStop(.44, '#b697c2')
  base.addColorStop(1, '#424e78')
  context.fillStyle = base; context.fillRect(0, 0, canvas.width, canvas.height)
  const glow = (x: number, y: number, radius: number, color: string) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient; context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  glow(-20, 700, 650, 'rgba(255,224,161,1)')
  glow(210, 720, 300, 'rgba(255,208,148,0.7)')
  glow(470, 800, 520, 'rgba(255,179,171,0.92)')
  glow(1220, 890, 680, 'rgba(155,171,225,0.92)')
  glow(800, 520, 600, 'rgba(206,169,222,0.40)')
  glow(100, 80, 420, 'rgba(255,209,182,0.46)')
  // A broad reflection beneath the sculpture, baked into the backdrop.
  context.save()
  context.translate(790, 880); context.rotate(.09); context.scale(1, .045)
  glow(0, 0, 540, 'rgba(255,224,210,0.24)')
  context.restore()
  const background = new THREE.CanvasTexture(canvas)
  background.colorSpace = THREE.SRGBColorSpace
  scene.background = background

  scene.add(new THREE.HemisphereLight('#eddefa', '#f1b093', .7))
  const key = new THREE.DirectionalLight('#ffeedc', 2.7)
  key.position.set(-3, 5, 4); scene.add(key)
  const cool = new THREE.DirectionalLight('#c6c8ff', 1.1)
  cool.position.set(4, 2, 2); scene.add(cool)
  const bounce = new THREE.DirectionalLight('#ff9f70', 2.0)
  bounce.position.set(-4, -3, 1); scene.add(bounce)
  return { dispose() { environment.dispose(); background.dispose() } }
}
