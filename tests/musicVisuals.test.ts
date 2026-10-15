import { describe, expect, test } from 'bun:test'
import * as THREE from 'three'
import { createMusicVisuals } from '../src/musicVisuals'

function setup() {
  const scene = new THREE.Scene(), visuals = createMusicVisuals(scene)
  let draws = 0, material: THREE.ShaderMaterial
  const renderer = {
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    render: (pass: THREE.Scene) => { draws++; material = (pass.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>).material },
  } as unknown as THREE.WebGLRenderer
  const frame = (dt = 1 / 30, paused = false) => { visuals.update(dt, 0, paused); visuals.paint(renderer) }
  frame()
  return { scene, visuals, frame, get material() { return material! }, get draws() { return draws } }
}

describe('continuous procedural atmosphere', () => {
  test('drifts before any song is selected, and honors reduced motion', () => {
    const view = setup(), before = view.material.uniforms.uTime.value
    for (let i = 0; i < 30; i++) view.frame()
    expect(view.material.uniforms.uTime.value - before).toBeCloseTo(1)
    expect(view.draws).toBeGreaterThan(20)
    const frozen = view.material.uniforms.uTime.value, draws = view.draws
    for (let i = 0; i < 30; i++) view.frame(1 / 30, true)
    expect(view.material.uniforms.uTime.value).toBe(frozen)
    expect(view.draws).toBe(draws)
    view.visuals.dispose()
  })

  test('selection changes colors continuously without resetting motion or swapping the backdrop', () => {
    const view = setup(), texture = view.scene.background
    const start = (view.material.uniforms.uWarm.value as THREE.Color).clone()
    const time = view.material.uniforms.uTime.value
    view.visuals.select('ink')
    expect(view.material.uniforms.uWarm.value.equals(start)).toBe(true)
    expect(view.material.uniforms.uTime.value).toBe(time)
    view.frame()
    const first = view.material.uniforms.uWarm.value.clone()
    expect(first.equals(start)).toBe(false)
    for (let i = 0; i < 120; i++) { view.visuals.setTravel(i / 119); view.frame() }
    const last = view.material.uniforms.uWarm.value as THREE.Color
    expect(Math.abs(first.r - start.r)).toBeLessThan(Math.abs(last.r - start.r) * .1)
    expect(view.scene.background).toBe(texture)
    expect(view.material.uniforms.uTime.value).toBeGreaterThan(time + 4)
    view.visuals.dispose()
  })

  test('rapid changes and return to the hero preserve the current color and drift phase', () => {
    const view = setup(), texture = view.scene.background
    view.visuals.select('coral')
    for (let i = 0; i < 10; i++) view.frame()
    const inBetween = view.material.uniforms.uWarm.value.clone(), time = view.material.uniforms.uTime.value
    view.visuals.select('blue'); view.visuals.reset(); view.visuals.setTravel(0)
    expect(view.material.uniforms.uWarm.value.equals(inBetween)).toBe(true)
    expect(view.material.uniforms.uTime.value).toBe(time)
    expect(view.scene.background).toBe(texture)
    view.frame()
    expect(view.material.uniforms.uTime.value).toBeGreaterThan(time)
    view.visuals.dispose()
  })
})
