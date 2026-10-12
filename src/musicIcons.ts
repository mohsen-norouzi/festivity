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
    // Preserve each original contour as a bar ID for a single-draw equalizer.
    if (name === 'wave' || name === 'pause') {
      parts.sort((a, b) => {
        a.computeBoundingBox(); b.computeBoundingBox()
        return a.boundingBox!.min.x - b.boundingBox!.min.x
      })
      parts.forEach((part, index) => {
        const count = part.getAttribute('position').count
        part.computeBoundingBox()
        const centerY = (part.boundingBox!.min.y + part.boundingBox!.max.y) / 2
        const halfHeight = (part.boundingBox!.max.y - part.boundingBox!.min.y) / 2
        part.setAttribute('barId', new THREE.BufferAttribute(new Float32Array(count).fill(index), 1))
        part.setAttribute('barCenter', new THREE.BufferAttribute(new Float32Array(count).fill(centerY), 1))
        part.setAttribute('barHeight', new THREE.BufferAttribute(new Float32Array(count).fill(halfHeight), 1))
      })
    }
    const geometry = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    geometry.computeBoundingBox()
    const size = geometry.boundingBox!.getSize(new THREE.Vector3())
    const center = geometry.boundingBox!.getCenter(new THREE.Vector3())
    const scale = .73 / Math.max(size.x, size.y)
    geometry.translate(-center.x, -center.y, -center.z)
    geometry.scale(scale, scale, scale)
    geometry.rotateX(Math.PI)
    if (name === 'wave' || name === 'pause') {
      const centers = geometry.getAttribute('barCenter'), heights = geometry.getAttribute('barHeight')
      for (let i = 0; i < centers.count; i++) {
        centers.setX(i, -(centers.getX(i) - center.y) * scale)
        heights.setX(i, heights.getX(i) * scale)
      }
    }
    cache.set(name, geometry)
    return geometry
  }
  return { get, dispose() { cache.forEach(geometry => geometry.dispose()); cache.clear() } }
}
