import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createTileReactions, heartbeat } from '../src/tileReactions'
import { createBurstLifecycle, INFLATION_SECONDS } from '../src/burstLifecycle'

const sound = { time: .4, phase: .09, energy: .6 }
function settle(reactions: ReturnType<typeof createTileReactions>, selected: number, playing: boolean, paused = false) {
  for (let i = 0; i < 100; i++) reactions.update(1 / 60, selected, playing, sound, paused)
}

describe('per-shape music reactions', () => {
  test('waveforms animate without tinting their shared material, then settle when stopped', () => {
    const shared = new THREE.MeshPhysicalMaterial({ color: '#f5dbff' })
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(), shared)
    const other = new THREE.Mesh(new THREE.BoxGeometry(), shared)
    const reactions = createTileReactions(['wave', 'wave'])
    reactions.register(0, glyph); reactions.register(1, other)
    settle(reactions, 0, true)
    expect(reactions.activity(0)).toBeGreaterThan(.999)
    expect(reactions.activity(1)).toBe(0)
    expect(glyph.material.color.equals(shared.color)).toBe(true)
    expect(other.material.color.equals(shared.color)).toBe(true)
    expect(reactions.scale(0)).toBe(1)
    settle(reactions, 0, false)
    expect(reactions.activity(0)).toBe(0)
    reactions.dispose()
  })

  test('the heart changes its own material and beats; mute/pause/selection changes restore its pose', () => {
    const body = new THREE.MeshPhysicalMaterial({ color: '#f18f86' }), base = body.color.clone()
    const glyph = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ color: '#fff0f5' }))
    glyph.scale.setScalar(.84)
    const reactions = createTileReactions(['heart', 'wave'])
    reactions.register(0, glyph, body)
    settle(reactions, 0, true)
    expect(body.color.equals(base)).toBe(false)
    expect(reactions.scale(0)).toBeGreaterThan(1.039)
    expect(reactions.scale(0)).toBeLessThan(1.041)
    expect(glyph.scale.x).toBeGreaterThan(.94)
    settle(reactions, 0, true, true)
    expect(reactions.scale(0)).toBe(1)
    expect(glyph.scale.x).toBe(.84)
    settle(reactions, 1, true)
    expect(body.color.equals(base)).toBe(true)
    expect(reactions.scale(0)).toBe(1)
    reactions.reset(); expect(reactions.activity(1)).toBe(0)
    reactions.dispose()
  })

  test('text changes to gold independently and returns exactly to the original lettering color', () => {
    const material = new THREE.MeshBasicMaterial({ color: '#e0c9f0' })
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(), material)
    const reactions = createTileReactions(['lettering'])
    reactions.register(0, glyph)
    settle(reactions, 0, true)
    expect(glyph.material.color.r).toBeGreaterThan(glyph.material.color.b * 2)
    expect(material.color.getHexString()).toBe('e0c9f0')
    expect(reactions.scale(0)).toBe(1)
    settle(reactions, 0, false)
    expect(glyph.material.color.equals(material.color)).toBe(true)
    reactions.dispose()
  })

  test('heartbeat has two pulses and a quiet interval', () => {
    expect(heartbeat(.09)).toBeGreaterThan(.99)
    expect(heartbeat(.29)).toBeGreaterThan(.54)
    expect(heartbeat(.7)).toBeLessThan(.001)
  })

  test('heartbeat collision dimensions match rendered inflation without accumulating size', () => {
    const body = {
      position: new THREE.Vector3(), previous: new THREE.Vector3(), home: new THREE.Vector3(),
      velocity: new THREE.Vector3(), spin: new THREE.Vector3(), rotation: new THREE.Quaternion(),
      halfSize: new THREE.Vector3(.8, .8, .675), radius: 1, mass: 1, shapePower: 3.8,
    }
    let pulse = 1.04, pops = 0
    const life = createBurstLifecycle([body], () => { pops++ }, () => {}, () => pulse)
    for (let i = 0; i < 180; i++) life.step(1 / 90)
    expect(body.radius).toBeCloseTo(1.04, 6)
    expect(body.halfSize.x).toBeCloseTo(.8 * 1.04, 6)
    expect(life.scale(0)).toBeCloseTo(body.radius, 8)
    life.start(0)
    for (let i = 0; i < 90; i++) life.step(1 / 90)
    expect(body.radius).toBeGreaterThan(1.15)
    expect(life.scale(0)).toBeCloseTo(body.radius, 8)
    pulse = 1; life.step(1 / 90)
    expect(body.halfSize.x / body.radius).toBeCloseTo(.8, 8)
    for (let i = 0; i < Math.ceil((INFLATION_SECONDS - 1) * 90); i++) life.step(1 / 90)
    expect(pops).toBe(1)
  })
})
