import * as THREE from 'three'
import type { MusicIcon } from './musicIcons'

export type ReactionKind = MusicIcon | 'lettering' | 'breath' | 'bubble'
type GlyphMaterial = THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial
type Entry = {
  kind: ReactionKind; amount: number; scale: number; glyph?: THREE.Mesh<THREE.BufferGeometry, GlyphMaterial>
  position?: THREE.Vector3; glyphScale?: THREE.Vector3; color?: THREE.Color
  heart?: THREE.MeshPhysicalMaterial; heartColor?: THREE.Color
  bars?: { uBarActivity: { value: number }; uBarTime: { value: number }; uBarEnergy: { value: number } }
}

export function heartbeat(phase: number) {
  const pulse = (center: number, width: number) => Math.exp(-(((phase - center) / width) ** 2))
  return pulse(.09, .055) + .55 * pulse(.29, .075)
}

/** Symbol-specific reactions. Only the heart changes its body material. */
export function createTileReactions(kinds: readonly ReactionKind[]) {
  const entries: Entry[] = kinds.map(kind => ({ kind, amount: 0, scale: 1 }))
  const materials: GlyphMaterial[] = []
  const gold = new THREE.Color('#f9cc70'), goldLight = new THREE.Color('#ffe7a4')
  const rose = new THREE.Color('#d52957'), apricot = new THREE.Color('#ff6029'), heartTone = new THREE.Color()
  const ivory = new THREE.Color('#fff1e2'), ice = new THREE.Color('#b8dbff')
  let time = 0, phase = 0
  return {
    register(index: number, glyph?: THREE.Mesh<THREE.BufferGeometry, GlyphMaterial>, heart?: THREE.MeshPhysicalMaterial) {
      const entry = entries[index]
      if (heart) { entry.heart = heart; entry.heartColor = heart.color.clone() }
      if (!glyph) return
      entry.glyph = glyph
      glyph.material = glyph.material.clone()
      materials.push(glyph.material)
      entry.position = glyph.position.clone(); entry.glyphScale = glyph.scale.clone(); entry.color = glyph.material.color.clone()
      if (entry.kind === 'wave' || entry.kind === 'pause') {
        const bars = entry.bars = { uBarActivity: { value: 0 }, uBarTime: { value: 0 }, uBarEnergy: { value: 0 } }
        glyph.material.onBeforeCompile = shader => {
          Object.assign(shader.uniforms, bars)
          shader.vertexShader = `
            attribute float barId, barCenter, barHeight;
            uniform float uBarActivity, uBarTime, uBarEnergy;
            float barScale() {
              float wave = .5 + .5 * sin(uBarTime * (7.0 + barId * .45) + barId * 1.8);
              float halfHeight = .075 + .27 * wave * (.65 + .35 * uBarEnergy);
              return mix(1.0, halfHeight / max(barHeight, .01), uBarActivity);
            }
          ` + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal.y /= barScale();')
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y = barCenter + (position.y - barCenter) * barScale();')
        }
        glyph.material.customProgramCacheKey = () => 'music-bars-v1'
      }
    },
    update(dt: number, selected: number, playing: boolean, sound: { time: number; phase: number; energy: number }, paused: boolean) {
      if (playing && !paused) { time = sound.time; phase = sound.phase }
      const beat = heartbeat(phase), ease = 1 - Math.exp(-dt * 12)
      let changing = false
      entries.forEach((entry, index) => {
        const target = playing && index === selected ? 1 : 0
        changing ||= Math.abs(entry.amount - target) > .001
        entry.amount = THREE.MathUtils.lerp(entry.amount, target, ease)
        if (entry.amount < .0001) entry.amount = 0
        const amount = entry.amount, movement = paused ? 0 : amount
        entry.scale = 1 + movement * (entry.kind === 'heart' ? .04 * beat : entry.kind === 'bubble' ? .035 * beat : entry.kind === 'breath' ? .018 * (.5 + .5 * Math.sin(time * 3)) : 0)
        if (entry.heart && entry.heartColor) {
          heartTone.copy(rose).lerp(apricot, .5 + .5 * Math.sin(time * .75))
          entry.heart.color.copy(entry.heartColor).lerp(heartTone, amount * .82)
        }
        const glyph = entry.glyph
        if (!glyph) return
        glyph.position.copy(entry.position!); glyph.scale.copy(entry.glyphScale!); glyph.rotation.set(0, 0, 0)
        glyph.material.color.copy(entry.color!)
        if (entry.bars) {
          entry.bars.uBarActivity.value = movement
          entry.bars.uBarTime.value = time
          entry.bars.uBarEnergy.value = sound.energy
        } else if (entry.kind === 'heart') {
          glyph.scale.multiplyScalar(1 + movement * beat * .14)
          glyph.material.color.lerp(ivory, amount * (.55 + beat * .45))
        } else if (entry.kind === 'lettering') {
          glyph.material.color.lerp(gold, amount)
          glyph.material.color.lerp(goldLight, movement * (.14 + .10 * Math.sin(time * 1.8)))
        } else if (entry.kind === 'note') {
          glyph.rotation.z = Math.sin(time * 4) * .12 * movement
          glyph.position.y += Math.sin(time * 4) * .025 * movement
          glyph.material.color.lerp(goldLight, amount * .65)
        } else if (entry.kind === 'headphones') {
          glyph.rotation.z = Math.sin(time * 5) * .085 * movement
          glyph.scale.multiplyScalar(1 + movement * beat * .07)
          glyph.material.color.lerp(ice, amount * .75)
        } else if (entry.kind === 'cloud') {
          glyph.position.y += Math.sin(time * 2) * .045 * movement
          glyph.scale.x *= 1 + Math.sin(time * 2) * .035 * movement
        } else if (entry.kind === 'globe') {
          glyph.rotation.z = (time * .32 % (Math.PI * 2)) * movement
          glyph.material.color.lerp(goldLight, amount * .65)
        } else if (entry.kind === 'sparkle') {
          glyph.rotation.z = Math.sin(time * 2.5) * .3 * movement
          glyph.scale.multiplyScalar(1 + movement * (.07 + .1 * Math.sin(time * 4)))
          glyph.material.color.lerp(goldLight, amount)
        } else if (entry.kind === 'play') {
          glyph.scale.multiplyScalar(1 + movement * beat * .12)
          glyph.material.color.lerp(ice, amount)
        }
      })
      return playing && !paused || changing
    },
    scale(index: number) { return entries[index]?.scale ?? 1 },
    activity(index: number) { return entries[index]?.amount ?? 0 },
    kind(index: number) { return entries[index]?.kind ?? '' },
    reset() {
      time = phase = 0
      entries.forEach(entry => { entry.amount = 0; entry.scale = 1 })
      this.update(0, -1, false, { time: 0, phase: 0, energy: 0 }, true)
    },
    dispose() { materials.forEach(material => material.dispose()) },
  }
}
