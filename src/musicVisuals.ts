import * as THREE from 'three'
import { MUSIC_MOODS, type MoodId } from './musicMoods'

const destinationColors: Record<MoodId, readonly string[]> = {
  coral: ['#653a4c', '#dd826f', '#ffd6a4', '#d46f91'],
  ink: ['#272c47', '#64718e', '#beafd8', '#8daee4'],
  lilac: ['#543662', '#c66dad', '#ffb9d7', '#967fea'],
  pearl: ['#746270', '#c8abaf', '#fff0cf', '#f5b79d'],
  glass: ['#665176', '#b089ad', '#ffd6b0', '#cfbaff'],
  blue: ['#3e4069', '#887ab5', '#ddc8ff', '#8ebcdb'],
  bubble: ['#50567d', '#a092c1', '#f3d9ee', '#aee0e7'],
}

/** Small cached atmosphere texture; no bloom or environment rebakes. */
export function createMusicVisuals(scene: THREE.Scene, baseline: THREE.Texture) {
  const targets = ['#4d3f69', '#a678a3', '#ffc08a', '#d28fe7'].map(color => new THREE.Color(color))
  const uniforms = {
    uBase: { value: baseline }, uTime: { value: 0 }, uMix: { value: 0 }, uEnergy: { value: 0 },
    uDeep: { value: targets[0].clone() }, uMid: { value: targets[1].clone() },
    uLight: { value: targets[2].clone() }, uOther: { value: targets[3].clone() },
    uSkyDeep: { value: new THREE.Color() }, uSkyMid: { value: new THREE.Color() },
    uSkyLight: { value: new THREE.Color() }, uSkyOther: { value: new THREE.Color() },
    uAspect: { value: 1 }, uTravel: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: `
      uniform sampler2D uBase;
      uniform float uTime, uMix, uEnergy, uAspect, uTravel;
      uniform vec3 uDeep, uMid, uLight, uOther;
      uniform vec3 uSkyDeep, uSkyMid, uSkyLight, uSkyOther;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv;
        float t = uTime * .13;
        float drift = sin(p.x * 3.8 + t) * .10 + cos(p.x * 7.0 - t * .8) * .035;
        float ribbon = exp(-pow((p.y - .2 - p.x * .43 - drift) * 5.8, 2.0));
        float echo = exp(-pow((p.y - .86 + p.x * .27 + drift) * 7.0, 2.0));
        vec2 center = vec2(.49 + sin(t * .7) * .12, .48 + cos(t) * .1);
        vec2 d = (p - center) * vec2(min(uAspect, 1.8), 1.0);
        float haze = exp(-dot(d, d) * 3.3);
        vec3 base = texture2D(uBase, vec2(vUv.x, clamp(vUv.y + uTravel * .18, 0.0, 1.0))).rgb;
        // The destination carries the selected material's palette, independently of
        // later track changes. Broad moving light fields keep it alive and light.
        vec2 warm = (p - vec2(.1 + sin(t * .65) * .15, .26 + cos(t * .5) * .09)) * vec2(min(uAspect, 1.6), 1.0);
        vec2 cool = (p - vec2(.87 + cos(t * .4) * .1, .75 + sin(t * .6) * .12)) * vec2(min(uAspect, 1.6), 1.0);
        float warmFog = exp(-dot(warm, warm) * 3.4);
        float coolFog = exp(-dot(cool, cool) * 4.0);
        vec3 upperSky = mix(uSkyDeep, uSkyMid, .25 + .24 * sin(p.y * 2.8 + drift * 3.0));
        upperSky = mix(upperSky, uSkyLight, warmFog * .78);
        upperSky = mix(upperSky, uSkyOther, coolFog * .55);
        upperSky = mix(upperSky, uSkyDeep, haze * .65);
        upperSky += uSkyLight * ribbon * (.018 + uEnergy * .035);
        float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5;
        upperSky += grain * .004;
        base = mix(base, upperSky, smoothstep(.08, .94, uTravel));
        // Colored stage light drifts over the bright haze without dimming the backdrop.
        vec3 glow = uLight * ribbon * (.025 + uEnergy * .035)
                  + uOther * echo * .045 + uMid * haze * .02;
        vec3 color = base * (vec3(1.0) + uLight * haze * .1) + glow;
        gl_FragColor = vec4(mix(base, color, uMix), 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  background.frustumCulled = false; background.renderOrder = -1000
  const atmosphere = new THREE.Scene(), camera = new THREE.Camera()
  atmosphere.add(background)
  const target = new THREE.WebGLRenderTarget(768, 432, { depthBuffer: false, stencilBuffer: false, type: THREE.HalfFloatType })
  target.texture.colorSpace = THREE.LinearSRGBColorSpace
  let enabled = false, paintElapsed = 1, dirty = false, baselineVersion = baseline.version
  const palette = [uniforms.uDeep, uniforms.uMid, uniforms.uLight, uniforms.uOther]
  return {
    select(mood: MoodId) {
      enabled = true
      const colors = MUSIC_MOODS[mood]
      ;[colors.deep, colors.mid, colors.light, colors.secondary].forEach((color, i) => targets[i].set(color))
    },
    setDestination(mood: MoodId) {
      const palette = [uniforms.uSkyDeep, uniforms.uSkyMid, uniforms.uSkyLight, uniforms.uSkyOther]
      palette.forEach((uniform, i) => uniform.value.set(destinationColors[mood][i]))
      dirty = true
    },
    reset() { enabled = false },
    setTravel(value: number) { if (uniforms.uTravel.value !== value) { uniforms.uTravel.value = value; dirty = true } },
    update(dt: number, energy: number, paused: boolean) {
      const baseChanged = baselineVersion !== baseline.version
      baselineVersion = baseline.version
      dirty ||= baseChanged
      const ease = 1 - Math.exp(-dt * 2.3)
      paintElapsed += dt
      uniforms.uMix.value = THREE.MathUtils.lerp(uniforms.uMix.value, enabled ? 1 : 0, ease)
      palette.forEach((uniform, i) => uniform.value.lerp(targets[i], ease))
      uniforms.uEnergy.value += ((paused ? 0 : energy) - uniforms.uEnergy.value) * ease
      if (!paused) uniforms.uTime.value += dt
      const changing = Math.abs(uniforms.uMix.value - (enabled ? 1 : 0)) > .001 || palette.some((uniform, i) => Math.abs(uniform.value.r - targets[i].r) + Math.abs(uniform.value.g - targets[i].g) + Math.abs(uniform.value.b - targets[i].b) > .001)
      dirty ||= changing || enabled && !paused
      if (!enabled && uniforms.uMix.value < .001 && uniforms.uTravel.value === 0) { scene.background = baseline; dirty = false }
      return enabled && !paused || changing || baseChanged
    },
    paint(renderer: THREE.WebGLRenderer) {
      if (!dirty || paintElapsed < 1 / 30) return
      paintElapsed = 0; dirty = false
      const previous = renderer.getRenderTarget()
      renderer.setRenderTarget(target); renderer.render(atmosphere, camera); renderer.setRenderTarget(previous)
      scene.background = target.texture
    },
    resize(aspect: number) {
      uniforms.uAspect.value = aspect
      // Soft haze needs only a small cached texture; the sculpture stays full resolution.
      target.setSize(aspect >= 1 ? 960 : Math.round(768 * aspect), aspect >= 1 ? Math.round(960 / aspect) : 768)
      dirty = true; paintElapsed = 1
    },
    dispose() { target.dispose(); background.geometry.dispose(); material.dispose() },
  }
}
