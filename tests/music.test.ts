import { describe, expect, test } from 'bun:test'
import { MUSIC_MOODS, musicStep, noteFrequency, type MoodId } from '../src/musicMoods'
import { createMusicAudio } from '../src/musicAudio'

function fakeAudio() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelAndHoldAtTime() {} })
  const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), detune: param(), delayTime: param(), Q: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() })
  return {
    state: 'running', currentTime: 0, sampleRate: 100, destination: node(), onstatechange: null,
    resume: () => Promise.resolve(), close: () => Promise.resolve(),
    createGain: node, createBiquadFilter: node, createOscillator: node, createBufferSource: node,
    createDynamicsCompressor: node, createDelay: node,
    createBuffer: () => ({ getChannelData: () => new Float32Array(100) }),
    createAnalyser: () => ({ ...node(), fftSize: 512, getFloatTimeDomainData: (data: Float32Array) => data.fill(.02) }),
  } as unknown as AudioContext
}

describe('musical moods', () => {
  test('bounded four-bar scores have distinct melodies and useful instrument ranges', () => {
    const scores = Object.keys(MUSIC_MOODS).map(id => {
      const events = Array.from({ length: 32 }, (_, step) => musicStep(id as MoodId, step)).flat()
      expect(events.length).toBeLessThan(110)
      expect(events.some(event => event.voice === 'pad')).toBe(true)
      expect(events.some(event => event.voice === 'bass')).toBe(true)
      for (const event of events) {
        expect(event.velocity).toBeGreaterThan(0)
        expect(event.velocity).toBeLessThan(.3)
        expect(event.duration).toBeGreaterThan(0)
        if (['pad', 'key', 'bass'].includes(event.voice)) {
          expect(event.note).toBeGreaterThanOrEqual(36)
          expect(event.note).toBeLessThan(90)
        }
      }
      return JSON.stringify(events)
    })
    expect(new Set(scores).size).toBe(7)
    expect(noteFrequency(69)).toBe(440)
  })

  test('loads silently, repeated clicks do not restart the score, rapid mood changes stay bounded', () => {
    let contexts = 0
    const audio = createMusicAudio(() => {}, () => { contexts++; return fakeAudio() })
    try {
      audio.setMuted(false)
      expect(contexts).toBe(0)
      expect(audio.contextState).toBe('idle')
      audio.select('coral')
      const firstNotes = audio.scheduledNotes
      expect(firstNotes).toBeGreaterThan(0)
      for (let i = 0; i < 20; i++) audio.select('coral')
      expect(audio.scheduledNotes).toBe(firstNotes)
      for (let i = 0; i < 20; i++) audio.select(i % 2 ? 'glass' : 'blue')
      expect(contexts).toBe(1)
      expect(audio.voices).toBeLessThanOrEqual(firstNotes * 2)
      expect(audio.sample().energy).toBeGreaterThan(0)
    } finally { audio.dispose() }
  })

  test('mute, pause, visibility, and reset never accidentally start a new soundtrack', () => {
    let contexts = 0, state = { mood: null, playing: false, audible: false } as Parameters<Parameters<typeof createMusicAudio>[0]>[0]
    const audio = createMusicAudio(value => { state = value }, () => { contexts++; return fakeAudio() })
    try {
      audio.setMuted(true); audio.select('ink')
      expect(contexts).toBe(0)
      expect(state).toEqual({ mood: 'ink', playing: true, audible: false })
      audio.setMuted(false)
      expect(contexts).toBe(1)
      expect(state.audible).toBe(true)
      audio.toggle(); audio.setHidden(true); audio.setHidden(false)
      expect(state.playing).toBe(false)
      audio.toggle(); expect(state.audible).toBe(true)
      audio.reset(); audio.setMuted(false)
      expect(state).toEqual({ mood: null, playing: false, audible: false })
      const count = audio.scheduledNotes
      audio.setHidden(true); audio.setHidden(false)
      expect(audio.scheduledNotes).toBe(count)
    } finally { audio.dispose() }
  })
})
