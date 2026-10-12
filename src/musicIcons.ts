import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type MusicIcon = 'note' | 'play' | 'pause' | 'wave' | 'heart' | 'headphones'

function extrude(shape: THREE.Shape) {
  return new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .008, bevelThickness: .008, curveSegments: 24 })
}

function bar(width: number, height: number, x: number, y = 0) {
  const geometry = new RoundedBoxGeometry(width, height, .045, 2, Math.min(width / 2, .02))
  geometry.translate(x, y, .015)
  return geometry
}

function combine(parts: THREE.BufferGeometry[]) {
  const normalized = parts.map(part => part.index ? part.toNonIndexed() : part)
  const result = mergeGeometries(normalized)
  new Set([...parts, ...normalized]).forEach(part => part.dispose())
  result.computeBoundingBox()
  const center = result.boundingBox!.getCenter(new THREE.Vector3())
  result.translate(-center.x, -center.y, 0)
  return result
}

export function makeMusicIcons(): Record<MusicIcon, THREE.BufferGeometry> {
  const leftNote = new THREE.Shape()
  leftNote.absellipse(-.23, -.22, .12, .088, 0, Math.PI * 2, false, .3)
  const rightNote = new THREE.Shape()
  rightNote.absellipse(.20, -.16, .12, .088, 0, Math.PI * 2, false, .3)
  const beam = new THREE.Shape()
  beam.moveTo(-.165, .20); beam.lineTo(.265, .28); beam.lineTo(.265, .385); beam.lineTo(-.165, .305); beam.closePath()
  const note = combine([extrude(leftNote), extrude(rightNote), bar(.056, .51, -.14, .04), bar(.056, .51, .29, .1), extrude(beam)])

  const triangle = new THREE.Shape()
  triangle.moveTo(-.17, -.23)
  triangle.quadraticCurveTo(-.22, -.27, -.22, -.19)
  triangle.lineTo(-.22, .25)
  triangle.quadraticCurveTo(-.22, .32, -.16, .28)
  triangle.lineTo(.26, .04)
  triangle.quadraticCurveTo(.32, 0, .26, -.035)
  triangle.closePath()

  const heart = new THREE.Shape()
  heart.moveTo(0, -.28)
  heart.bezierCurveTo(-.12, -.18, -.34, .01, -.34, .16)
  heart.bezierCurveTo(-.34, .39, -.1, .44, 0, .24)
  heart.bezierCurveTo(.1, .44, .34, .39, .34, .16)
  heart.bezierCurveTo(.34, .01, .12, -.18, 0, -.28)

  const arcPoints = Array.from({ length: 33 }, (_, i) => {
    const angle = (i / 32) * Math.PI
    return new THREE.Vector3(Math.cos(angle) * .25, Math.sin(angle) * .29, .02)
  })
  const arc = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPoints), 40, .031, 8, false)
  const headphones = combine([arc, bar(.095, .235, -.25, -.045), bar(.095, .235, .25, -.045)])

  return {
    note,
    play: extrude(triangle),
    pause: combine([bar(.095, .52, -.115), bar(.095, .52, .115)]),
    wave: combine([.18, .34, .54, .72, .5, .3, .13].map((height, i) => bar(.047, height, (i - 3) * .088))),
    heart: extrude(heart),
    headphones,
  }
}
