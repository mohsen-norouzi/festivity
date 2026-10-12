import * as THREE from 'three'

export function createStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const studio = new THREE.Scene()
  studio.background = new THREE.Color('#252b46')
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
  panel('#fff2e5', 13, [-3, 5, 2], [6, 5])
  panel('#cbd7ff', 10, [4, 2, 1], [4, 7])
  panel('#ffa98e', 17, [-4, -2, 0], [5, 6])
  panel('#f7dcff', 8, [0, 5, -4], [7, 3])
  panel('#91bbff', 10, [3, -3, -2], [4, 4])
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
  const base = context.createLinearGradient(0, 0, 1536, 1000)
  base.addColorStop(0, '#343755')
  base.addColorStop(.42, '#686584')
  base.addColorStop(.7, '#565d83')
  base.addColorStop(1, '#303750')
  context.fillStyle = base; context.fillRect(0, 0, canvas.width, canvas.height)
  const glow = (x: number, y: number, radius: number, color: string) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient; context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  glow(1410, 30, 800, 'rgba(218,190,224,.82)')
  glow(900, 380, 630, 'rgba(156,150,204,.48)')
  glow(80, 680, 690, 'rgba(231,148,159,.52)')
  glow(470, 930, 600, 'rgba(238,155,159,.44)')
  glow(1070, 920, 670, 'rgba(113,146,224,.4)')
  const streak = (x: number, y: number, width: number, height: number, angle: number, color: string) => {
    context.save()
    context.translate(x, y); context.rotate(angle); context.scale(1, height / width)
    glow(0, 0, width, color)
    context.restore()
  }
  streak(570, 920, 940, 44, -.2, 'rgba(255,184,166,.48)')
  streak(180, 535, 620, 82, -.35, 'rgba(255,168,171,.35)')
  streak(1350, 45, 720, 58, -.56, 'rgba(245,190,222,.35)')
  streak(1190, 915, 490, 92, .13, 'rgba(162,183,246,.23)')
  const background = new THREE.CanvasTexture(canvas)
  background.colorSpace = THREE.SRGBColorSpace
  scene.background = background

  scene.add(new THREE.HemisphereLight('#eddefa', '#edaca2', .5))
  const key = new THREE.DirectionalLight('#ffece2', 2.5)
  key.position.set(-3, 5, 4); scene.add(key)
  const cool = new THREE.DirectionalLight('#b8d2ff', 1.3)
  cool.position.set(4, 2, 2); scene.add(cool)
  const bounce = new THREE.DirectionalLight('#ff9f70', 2.0)
  bounce.position.set(-4, -3, 1); scene.add(bounce)
  return { dispose() { environment.dispose(); background.dispose() } }
}
