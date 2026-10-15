import * as THREE from 'three'
import type { MoodId } from './musicMoods'

// Deep, rose haze, warm glow, light, violet haze, and a secondary light.
const HOME = ['#302944', '#a05d85', '#ff9c72', '#ffebc2', '#634b9b', '#f476bb'] as const
const PALETTES: Record<MoodId, readonly string[]> = {
  coral: ['#593448', '#b96c7f', '#ff9872', '#ffe0a5', '#9b698c', '#ffc0a4'],
  ink: ['#282c42', '#65657f', '#b69da9', '#e0d3e2', '#647da5', '#b6a0e0'],
  lilac: ['#453052', '#b05b9b', '#f28fc2', '#ffd3d8', '#8862c4', '#ed8edc'],
  pearl: ['#605061', '#b08c99', '#e5bc9d', '#fff0d0', '#9e8ab4', '#e7baca'],
  glass: ['#4a3b62', '#a577a1', '#efb09b', '#ffe4c1', '#9282c9', '#dca9e2'],
  blue: ['#343954', '#81779f', '#b6a1d1', '#e5d9f5', '#687eb8', '#ba9de8'],
  bubble: ['#464661', '#a293b6', '#d8b4c5', '#f4e4ed', '#7f9abb', '#b9d5e5'],
}

/** One procedural light field for the hero and ascent. Only its palette morphs. */
export function createMusicVisuals(scene: THREE.Scene) {
  const targets = HOME.map(color => new THREE.Color(color))
  const uniforms = {
    uTime: { value: 0 }, uEnergy: { value: 0 }, uAspect: { value: 1 }, uTravel: { value: 0 },
    uDeep: { value: targets[0].clone() }, uHaze: { value: targets[1].clone() },
    uWarm: { value: targets[2].clone() }, uLight: { value: targets[3].clone() },
    uCool: { value: targets[4].clone() }, uAccent: { value: targets[5].clone() },
  }
  const palette = [uniforms.uDeep, uniforms.uHaze, uniforms.uWarm, uniforms.uLight, uniforms.uCool, uniforms.uAccent]
  const material = new THREE.ShaderMaterial({
    uniforms, depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: `
      uniform float uTime, uEnergy, uAspect, uTravel;
      uniform vec3 uDeep, uHaze, uWarm, uLight, uCool, uAccent;
      varying vec2 vUv;
      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * .1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fog(vec2 p) {
        float n = noise(p) * .57;
        p = mat2(.8, -.6, .6, .8) * p * 2.03 + 8.4;
        n += noise(p) * .29;
        n += noise(p * 2.01 + 13.7) * .14;
        return n;
      }
      float cloud(vec2 p, vec2 center, vec2 spread) {
        vec2 d = (p - center) * spread;
        return exp(-dot(d, d));
      }
      void main() {
        float t = uTime * .16;
        vec2 p = vUv;
        p.y += uTravel * .12;
        vec2 metric = vec2(uAspect, 1.0);
        vec2 field = p * vec2(clamp(uAspect, .8, 1.9), 1.0);
        float haze = fog(field * 2.8 + vec2(t * .28, -t * .22));
        float silk = fog(field * 5.2 + vec2(-t * .2, t * .24) + 9.7);
        float wisps = fog(field * vec2(9.0, 3.5) + vec2(t * .2, -t * .3) + haze * 1.5);
        vec2 q = p + vec2(sin(p.y * 3.1 + t), cos(p.x * 3.4 - t * .8)) * .045;
        q += vec2(haze - .5, silk - .5) * .19;

        // Violet depth with rose smoke: irregular translucent layers rather than flat blobs.
        vec3 color = mix(uDeep * .74, uCool * .65, .18 + haze * .24);
        float rose = cloud(q, vec2(.3 + sin(t * .9) * .065, .57), vec2(3.3, 1.55));
        color = mix(color, uHaze, rose * (.24 + silk * .58));
        float violet = cloud(q, vec2(.94, .34 + sin(t * .9) * .07), vec2(4.0, 2.2));
        color = mix(color, uCool, violet * (.35 + wisps * .45));
        float plume = cloud(q, vec2(.28 + sin(t * .8) * .06, .42), vec2(6.2, 1.65));
        color = mix(color, uWarm, plume * smoothstep(.22, .85, wisps) * .72);
        float silkLight = smoothstep(.33, .78, silk);
        color *= .77 + silkLight * .42;

        // Broad amber light blooms into a feathered diagonal stage beam.
        vec2 glowCenter = vec2(-.055 + sin(t * .7) * .035, .26 + sin(t) * .045);
        float leftGlow = cloud(q, glowCenter, vec2(3.1, 4.5));
        color = mix(color, uWarm, leftGlow * .87);
        float slope = q.y - glowCenter.y + q.x * .4 + sin(q.x * 4.0 + t) * .025;
        float halo = exp(-slope * slope * 65.0) * exp(-max(q.x, 0.0) * 4.0);
        float beam = exp(-slope * slope * 850.0) * exp(-max(q.x, 0.0) * 4.3);
        float core = cloud(q, glowCenter, vec2(6.5, 10.0));
        color += uWarm * halo * .32;
        color += uLight * (beam * .88 + core * .76) * (.8 + haze * .4);

        // A distant light on the right, with magenta haze drifting beneath it.
        float shoulder = cloud(q, vec2(1.055, .82 + cos(t * .85) * .035), vec2(6.0, 6.8));
        color = mix(color, uWarm, shoulder * .7);
        color += uLight * shoulder * shoulder * .92;
        float glimmer = smoothstep(.46, .8, wisps) * violet;
        color += uAccent * glimmer * (.34 + uEnergy * .05);

        // Defocused, softly edged light circles at different depths. No sprite downloads.
        for (int i = 0; i < 18; i++) {
          float seed = float(i) + 2.0;
          vec2 point = vec2(hash(vec2(seed, 2.0)), hash(vec2(seed, 8.0)));
          point += vec2(sin(t * .8 + seed), cos(t * .65 + seed * 1.7)) * vec2(.024, .045);
          float radius = mix(.009, .027, hash(vec2(seed, 4.0)));
          float distance = length((p - point) * metric) / radius;
          float disc = 1.0 - smoothstep(.32, 1.3, distance);
          float glow = exp(-distance * distance * .65);
          float strength = mix(.1, .27, hash(vec2(seed, 6.0))) * (.75 + .25 * sin(t + seed * 2.1));
          vec3 tint = mix(uWarm, uAccent, smoothstep(.35, .9, point.x));
          color += tint * (disc + glow * .4) * strength;
        }

        // Grade the entire left side in the background itself; no text-shaped overlay.
        float left = 1.0 - smoothstep(.0, .48, p.x);
        color *= 1.0 - left * .27;
        // Fixed fine grain prevents banding without flicker or a texture download.
        color += (hash(gl_FragCoord.xy) - .5) * .003;
        gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  background.frustumCulled = false
  const atmosphere = new THREE.Scene(), camera = new THREE.Camera()
  atmosphere.add(background)
  const target = new THREE.WebGLRenderTarget(768, 432, { depthBuffer: false, stencilBuffer: false, type: THREE.HalfFloatType })
  target.texture.colorSpace = THREE.LinearSRGBColorSpace
  scene.background = target.texture
  let paintElapsed = 1, dirty = true
  const changePalette = (colors: readonly string[]) => colors.forEach((color, i) => targets[i].set(color))
  return {
    select(mood: MoodId) { changePalette(PALETTES[mood]) },
    reset() { changePalette(HOME) },
    setTravel(value: number) {
      if (uniforms.uTravel.value !== value) { uniforms.uTravel.value = value; dirty = true }
    },
    update(dt: number, energy: number, paused: boolean) {
      const ease = 1 - Math.exp(-dt * 1.15)
      paintElapsed += dt
      let changing = false
      palette.forEach((uniform, i) => {
        changing ||= Math.abs(uniform.value.r - targets[i].r) + Math.abs(uniform.value.g - targets[i].g) + Math.abs(uniform.value.b - targets[i].b) > .001
        uniform.value.lerp(targets[i], ease)
      })
      uniforms.uEnergy.value += ((paused ? 0 : energy) - uniforms.uEnergy.value) * ease
      // The atmosphere breathes silently too; reduced motion is the only pause.
      if (!paused) uniforms.uTime.value += dt
      dirty ||= changing || !paused
      return dirty
    },
    paint(renderer: THREE.WebGLRenderer) {
      if (!dirty || paintElapsed < 1 / 30) return
      paintElapsed %= 1 / 30
      dirty = false
      const previous = renderer.getRenderTarget()
      renderer.setRenderTarget(target); renderer.render(atmosphere, camera); renderer.setRenderTarget(previous)
    },
    resize(aspect: number) {
      uniforms.uAspect.value = aspect
      // Cache the soft field at a modest resolution, independent of the sharp sculpture.
      target.setSize(aspect >= 1 ? 960 : Math.round(768 * aspect), aspect >= 1 ? Math.round(960 / aspect) : 768)
      dirty = true; paintElapsed = 1
    },
    dispose() { target.dispose(); background.geometry.dispose(); material.dispose() },
  }
}
