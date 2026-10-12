import { describe, expect, test } from 'bun:test'
import { MUSIC_MOODS, type MusicState } from '../src/musicMoods'
import { createMusicAudio } from '../src/musicAudio'

class Media {
  src = ''; preload = ''; loop = false; paused = true; currentTime = 0; duration = 150
  plays = 0; releases = 0; auto = true
  onplaying: (() => void) | null = null
  onwaiting: (() => void) | null = null
  onpause: (() => void) | null = null
  onerror: (() => void) | null = null
  onloadedmetadata: (() => void) | null = null
  resolve?: () => void
  reject?: (reason: Error) => void
  play() {
    this.plays++; this.paused = false
    return new Promise<void>((resolve, reject) => {
      this.resolve = resolve; this.reject = reject
      if (this.auto) queueMicrotask(() => { if (!this.paused && this.src) this.begin(); else resolve() })
    })
  }
  begin() { this.onloadedmetadata?.(); this.onplaying?.(); this.resolve?.() }
  pause() { this.paused = true; this.onpause?.() }
  removeAttribute() { this.src = '' }
  load() { this.releases++ }
}

function harness(auto = true) {
  let contexts = 0
  const players: Media[] = []
  let state: MusicState = { mood: null, playing: false, audible: false }
  const ramps: number[] = []
  const node = () => ({ connect() {}, disconnect() {}, gain: { value: 0, setValueAtTime() {}, cancelAndHoldAtTime() {}, linearRampToValueAtTime(value: number) { ramps.push(value) } } })
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 48000, destination: node(), onstatechange: null,
    resume: () => Promise.resolve(), close: () => Promise.resolve(),
    createGain: node, createMediaElementSource: node,
    createAnalyser: () => ({ ...node(), fftSize: 512, frequencyBinCount: 256, smoothingTimeConstant: .65, getFloatTimeDomainData: (data: Float32Array) => data.fill(.05), getByteFrequencyData: (data: Uint8Array) => data.fill(100) }),
  }
  const audio = createMusicAudio(value => { state = value }, () => { contexts++; return ctx as unknown as AudioContext }, () => { const player = new Media(); player.auto = auto; players.push(player); return player as unknown as HTMLAudioElement })
  return { audio, players, ctx, ramps, get contexts() { return contexts }, get state() { return state } }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

describe('local song playback', () => {
  test('all seven materials use distinct, existing uploaded songs', async () => {
    const sources = Object.values(MUSIC_MOODS).map(song => song.src)
    expect(new Set(sources).size).toBe(7)
    for (const source of sources) expect(await Bun.file(new URL(`../public${decodeURIComponent(source)}`, import.meta.url)).exists()).toBe(true)
    expect(MUSIC_MOODS.glass.name).toBe("That's Life")
    expect(MUSIC_MOODS.glass.artist).toBe('Johny Grimes')
  })

  test('loads nothing before interaction; repeated selections never pause or restart playback', async () => {
    const h = harness()
    try {
      h.audio.setMuted(false)
      expect(h.contexts).toBe(0); expect(h.players.length).toBe(0)
      h.audio.select('coral'); await flush()
      expect(h.state.audible).toBe(true)
      expect(h.players[0].src).toBe(MUSIC_MOODS.coral.src)
      expect(h.players[0].preload).toBe('none'); expect(h.players[0].loop).toBe(true)
      h.players[0].currentTime = 24
      for (let i = 0; i < 20; i++) h.audio.select('coral')
      expect(h.players.length).toBe(1); expect(h.players[0].plays).toBe(1); expect(h.audio.time).toBe(24)
      expect(h.state.playing).toBe(true); expect(h.state.audible).toBe(true)
      h.ctx.currentTime = .1
      expect(h.audio.sample().energy).toBeGreaterThan(0)
      expect(h.audio.sample().time).toBe(24)
    } finally { h.audio.dispose() }
  })

  test('pause/resume, mute, and hidden tabs preserve position without accidental playback', async () => {
    const h = harness()
    try {
      h.audio.setMuted(true); h.audio.select('ink')
      expect(h.contexts).toBe(0); expect(h.state.playing).toBe(true); expect(h.state.audible).toBe(false)
      h.audio.setMuted(false); await flush()
      h.players[0].currentTime = 31
      h.audio.toggle(); h.audio.setHidden(true); h.audio.setHidden(false)
      expect(h.state.playing).toBe(false); expect(h.players[0].paused).toBe(true)
      h.audio.toggle(); await flush()
      expect(h.state.audible).toBe(true); expect(h.audio.time).toBe(31)
      h.audio.setMuted(true)
      expect(h.players[0].paused).toBe(true); expect(h.state.audible).toBe(false)
      h.audio.setMuted(false); await flush()
      expect(h.audio.time).toBe(31)
      h.audio.setHidden(true)
      expect(h.players[0].paused).toBe(true)
      h.audio.setHidden(false); await flush()
      expect(h.audio.time).toBe(31); expect(h.state.audible).toBe(true)
      h.audio.reset(); h.audio.setHidden(true); h.audio.setHidden(false); h.audio.setMuted(false)
      expect(h.audio.streams).toBe(0); expect(h.state.mood).toBe(null); expect(h.state.playing).toBe(false)
      expect(h.players[0].src).toBe('')
    } finally { h.audio.dispose() }
  })

  test('crossfades only when the new recording is ready; fast switches keep at most two sources', async () => {
    const h = harness(false)
    try {
      h.audio.select('glass'); h.players[0].begin(); await flush()
      h.audio.select('blue')
      expect(h.state.loading).toBe(true); expect(h.players[0].paused).toBe(false)
      expect(h.ramps.filter(value => value === 0).length).toBe(0)
      h.players[1].begin(); await flush()
      expect(h.ramps.includes(0)).toBe(true); expect(h.state.audible).toBe(true)
      for (let i = 0; i < 15; i++) {
        h.audio.select(i % 2 ? 'pearl' : 'ink')
        h.players.at(-1)!.begin(); await flush()
        expect(h.players.filter(player => player.src).length).toBeLessThanOrEqual(2)
        expect(h.audio.streams).toBeLessThanOrEqual(2)
      }
      h.audio.toggle()
      expect(h.players.every(player => player.paused)).toBe(true)
    } finally { h.audio.dispose() }
  })

  test('switching away releases the download and remembers that recording’s position', async () => {
    const h = harness()
    try {
      h.audio.select('coral'); await flush(); h.players[0].currentTime = 42
      h.audio.select('blue'); await flush()
      h.audio.select('lilac'); await flush()
      expect(h.players[0].releases).toBe(1); expect(h.players[0].src).toBe('')
      h.audio.select('coral'); await flush()
      expect(h.audio.time).toBe(42)
    } finally { h.audio.dispose() }
  })

  test('late play failures cannot stop a newer song, and loading cancellation stays silent', async () => {
    const h = harness(false)
    try {
      h.audio.select('coral')
      const lateReject = h.players[0].reject!
      h.audio.select('glass'); h.players[1].begin(); await flush()
      lateReject(new Error('Previous load cancelled')); await flush()
      expect(h.state.mood).toBe('glass'); expect(h.state.audible).toBe(true)
      h.audio.select('pearl'); h.audio.toggle()
      h.players[2].begin(); await flush()
      expect(h.state.playing).toBe(false); expect(h.audio.streams).toBe(0)
    } finally { h.audio.dispose() }
  })

  test('failed recordings show a retry state and dispose cancels every player', async () => {
    const h = harness(false)
    h.audio.select('bubble'); h.players[0].reject!(new Error('Unavailable')); await flush()
    expect(h.state.error).toBe(true); expect(h.state.playing).toBe(false); expect(h.audio.streams).toBe(0)
    h.audio.toggle(); h.players[1].begin(); await flush()
    expect(h.state.error).toBe(false); expect(h.state.audible).toBe(true)
    h.audio.dispose()
    expect(h.players.every(player => player.paused && !player.src)).toBe(true)
  })
})
