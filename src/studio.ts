import * as THREE from 'three'

export function createStudio(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const studio = new THREE.Scene()
  studio.background = new THREE.Color('#4b3b55')
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
  panel('#fff0df', 14, [-3, 5, 3], [5, 5])
  panel('#ded2ff', 12, [4, 2, 1], [3, 6])
  panel('#ffb16b', 20, [-4, -2, 1], [3, 7])
  panel('#f77bc6', 12, [1, 5, -4], [5, 3])
  panel('#ffc690', 10, [0, -4, 2], [5, 2])
  const generator = new THREE.PMREMGenerator(renderer)
  const environment = generator.fromScene(studio, .025)
  scene.environment = environment.texture
  scene.environmentIntensity = .92
  generator.dispose()
  panelGeometry.dispose()
  softbox.dispose()
  panels.forEach(material => material.dispose())

  scene.add(new THREE.HemisphereLight('#efdef2', '#d79a89', .65))
  const key = new THREE.DirectionalLight('#ffe6d7', 2.7)
  key.position.set(-3, 5, 4); scene.add(key)
  const cool = new THREE.DirectionalLight('#ccc8ff', 1.6)
  cool.position.set(4, 2, 2); scene.add(cool)
  const bounce = new THREE.DirectionalLight('#ffae68', 2.5)
  bounce.position.set(-4, -3, 1); scene.add(bounce)
  return { dispose() { environment.dispose() } }
}
