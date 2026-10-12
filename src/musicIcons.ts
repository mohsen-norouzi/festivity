import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import note from './assets/icons/music-notes-fill.svg?raw'
import play from './assets/icons/play-fill.svg?raw'
import pause from './assets/icons/pause-fill.svg?raw'
import wave from './assets/icons/waveform.svg?raw'
import heart from './assets/icons/heart-fill.svg?raw'
import headphones from './assets/icons/headphones-fill.svg?raw'
import cloud from './assets/icons/cloud.svg?raw'
import globe from './assets/icons/globe-simple.svg?raw'
import sparkle from './assets/icons/sparkle-fill.svg?raw'

const sources = { note, play, pause, wave, heart, headphones, cloud, globe, sparkle }
export type MusicIcon = keyof typeof sources

/** Original Phosphor contours, extruded once with a small machined bevel. */
export function createMusicIcons() {
  const loader = new SVGLoader()
  const cache = new Map<MusicIcon, THREE.BufferGeometry>()
  const get = (name: MusicIcon) => {
    const cached = cache.get(name)
    if (cached) return cached
    let svg = sources[name].replaceAll('currentColor', '#ffffff')
    if (name === 'cloud') svg = svg.replace('fill="none"', 'fill="#ffffff"').replace('stroke="#ffffff"', 'stroke="none"').replace('<path', '<g transform="scale(10.6666667)"><path').replace('</svg>', '</g></svg>')
    const parts = loader.parse(svg).paths.flatMap(path => SVGLoader.createShapes(path).map(shape =>
      new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: true, bevelSize: 1.15, bevelThickness: 1.15, bevelSegments: 2, steps: 1, curveSegments: 14 }),
    ))
    const geometry = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    geometry.computeBoundingBox()
    const size = geometry.boundingBox!.getSize(new THREE.Vector3())
    const center = geometry.boundingBox!.getCenter(new THREE.Vector3())
    const scale = .73 / Math.max(size.x, size.y)
    geometry.translate(-center.x, -center.y, -center.z)
    geometry.scale(scale, scale, scale)
    geometry.rotateX(Math.PI)
    cache.set(name, geometry)
    return geometry
  }
  return { get, dispose() { cache.forEach(geometry => geometry.dispose()); cache.clear() } }
}
