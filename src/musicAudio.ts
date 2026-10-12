import { MUSIC_MOODS, type MoodId, type MusicState } from './musicMoods'

type Deck = {
  mood: MoodId; media: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode
  started: boolean; waiting: boolean; attempt: number; pending: boolean
  cleanup?: ReturnType<typeof setTimeout>
}

/** Gesture-started, streamed recordings. Only the current and fading-out track
 * can be loaded; no full-song decoding or seven-file startup download. */
export function createMusicAudio(onState: (state: MusicState) => void, makeContext = () => new AudioContext(), makeMedia = () => new Audio()) {
  let context: AudioContext | undefined, master: GainNode, analyser: AnalyserNode
  let waveform: Float32Array<ArrayBuffer>, spectrum: Uint8Array<ArrayBuffer>
  let mood: MoodId | null = null, playing = false, muted = false, hidden = false, disposed = false, failed = false
  let active: Deck | undefined, outgoing: Deck | undefined
  const decks = new Set<Deck>()
  const positions = new Map<MoodId, number>()
  const sample = { energy: 0, beat: 0, phase: 0, time: 0 }
  let bassFloor = 0, lastBeat = -1, beatInterval = .65, sampleClock = 0
  const wanted = () => playing && !muted && !hidden && !disposed
  const current = (deck: Deck) => wanted() && active === deck && mood === deck.mood
  const publish = () => {
    if (disposed) return
    onState({ mood, playing, audible: wanted() && Boolean(active?.started && !active.waiting && !active.media.paused) && context?.state === 'running', loading: wanted() && Boolean(active && (!active.started || active.waiting)), error: failed })
  }
  const resetMeter = () => { sample.energy = sample.beat = sample.phase = sample.time = 0; bassFloor = 0; lastBeat = -1; beatInterval = .65; sampleClock = context?.currentTime ?? 0 }
  const initialize = () => {
    if (context) return context
    const ctx = context = makeContext()
    master = ctx.createGain(); master.gain.value = .65
    analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .65
    waveform = new Float32Array(analyser.fftSize)
    spectrum = new Uint8Array(analyser.frequencyBinCount)
    master.connect(analyser); analyser.connect(ctx.destination)
    ctx.onstatechange = publish
    return ctx
  }
  const remember = (deck: Deck) => {
    if (Number.isFinite(deck.media.currentTime)) positions.set(deck.mood, deck.media.currentTime)
  }
  const destroy = (deck: Deck) => {
    if (!decks.has(deck)) return
    if (deck.cleanup) clearTimeout(deck.cleanup)
    deck.attempt++
    remember(deck)
    deck.media.onplaying = deck.media.onwaiting = deck.media.onpause = deck.media.onerror = deck.media.onloadedmetadata = null
    deck.media.pause()
    deck.source.disconnect(); deck.gain.disconnect()
    // Abort a superseded network request and release its browser media buffer.
    deck.media.removeAttribute('src'); deck.media.load()
    decks.delete(deck)
    if (outgoing === deck) outgoing = undefined
    if (active === deck) active = undefined
  }
  const fadeOut = (deck: Deck) => {
    if (!context || deck.cleanup) return
    const at = context.currentTime
    deck.gain.gain.cancelAndHoldAtTime(at)
    deck.gain.gain.linearRampToValueAtTime(0, at + .65)
    deck.cleanup = setTimeout(() => destroy(deck), 700)
  }
  const silence = () => {
    if (outgoing) destroy(outgoing)
    if (active) {
      active.attempt++; active.pending = active.started = active.waiting = false
      remember(active); active.media.pause()
      active.gain.gain.cancelAndHoldAtTime(context!.currentTime)
      active.gain.gain.setValueAtTime(0, context!.currentTime)
    }
    resetMeter()
  }
  const fail = (deck: Deck, attempt: number) => {
    if (!current(deck) || deck.attempt !== attempt) return
    failed = true; playing = false
    silence(); destroy(deck); publish()
  }
  const createDeck = (value: MoodId) => {
    const ctx = context!, media = makeMedia()
    media.preload = 'none'; media.loop = true
    media.src = MUSIC_MOODS[value].src
    const source = ctx.createMediaElementSource(media), gain = ctx.createGain()
    gain.gain.value = 0; source.connect(gain); gain.connect(master)
    const deck: Deck = { mood: value, media, source, gain, started: false, waiting: false, attempt: 0, pending: false }
    decks.add(deck)
    media.onloadedmetadata = () => {
      const saved = positions.get(value) ?? 0
      if (saved > 0 && Number.isFinite(media.duration)) media.currentTime = Math.min(saved, Math.max(0, media.duration - .1))
    }
    media.onplaying = () => {
      if (!current(deck)) { if (!wanted() || outgoing !== deck) media.pause(); return }
      const first = !deck.started
      deck.started = true; deck.waiting = false; deck.pending = false
      if (first) {
        const at = ctx.currentTime
        gain.gain.cancelAndHoldAtTime(at); gain.gain.linearRampToValueAtTime(1, at + .6)
        resetMeter()
        if (outgoing) fadeOut(outgoing)
      }
      publish()
    }
    media.onwaiting = () => { if (current(deck)) { deck.waiting = true; publish() } }
    media.onpause = () => { if (active === deck) { deck.started = false; publish() } }
    media.onerror = () => fail(deck, deck.attempt)
    return deck
  }
  const start = () => {
    if (!mood || !wanted()) return
    const ctx = initialize()
    if (active?.mood !== mood) {
      if (active) {
        if (active.started && !active.media.paused) {
          if (outgoing) destroy(outgoing)
          outgoing = active; active = undefined
        } else destroy(active)
      }
      active = createDeck(mood)
    }
    const deck = active!
    if (deck.pending || deck.started && !deck.media.paused) { publish(); return }
    const attempt = ++deck.attempt
    deck.pending = true
    // Invoke both synchronously within the user's click, before any await.
    void ctx.resume().then(publish).catch(() => fail(deck, attempt))
    void deck.media.play().catch(() => fail(deck, attempt))
    publish()
  }
  return {
    select(value: MoodId) { if (disposed) return; mood = value; playing = true; failed = false; start(); publish() },
    toggle() { if (disposed) return; playing = !playing; failed = false; if (playing) { mood ??= 'glass'; start() } else silence(); publish() },
    setMuted(value: boolean) { muted = value; if (value) silence(); else start(); publish() },
    setHidden(value: boolean) { hidden = value; if (value) silence(); else start(); publish() },
    reset() { mood = null; playing = false; failed = false; silence(); if (active) destroy(active); positions.clear(); publish() },
    sample() {
      const dt = context ? Math.min(.1, Math.max(0, context.currentTime - sampleClock)) : 0
      sampleClock = context?.currentTime ?? 0
      let energy = 0
      if (wanted() && context?.state === 'running' && active?.started && !active.waiting && !active.media.paused) {
        analyser.getFloatTimeDomainData(waveform)
        analyser.getByteFrequencyData(spectrum)
        for (const value of waveform) energy += value * value
        energy = Math.min(1, Math.sqrt(energy / waveform.length) * 2.8)
        sample.time = active.media.currentTime
        // Detect bass attacks from the recording instead of inventing its BPM.
        const highBin = Math.min(spectrum.length - 1, Math.ceil(220 * analyser.fftSize / context.sampleRate))
        let bass = 0
        for (let i = 1; i <= highBin; i++) bass += spectrum[i] / 255
        bass /= Math.max(1, highBin)
        if (sample.time < lastBeat) lastBeat = -1 // The recording has looped.
        const since = sample.time - lastBeat
        if (bass > .12 && bass > bassFloor * 1.12 && (lastBeat < 0 || since > .28)) {
          if (lastBeat >= 0 && since < 1.2) beatInterval += (since - beatInterval) * .25
          lastBeat = sample.time; sample.beat = 1
        } else sample.beat *= Math.exp(-dt * 8)
        bassFloor += (bass - bassFloor) * (1 - Math.exp(-dt * 3))
        sample.phase = lastBeat < 0 ? 1 : Math.min(1, (sample.time - lastBeat) / beatInterval)
      } else sample.beat = 0
      sample.energy += (energy - sample.energy) * (1 - Math.exp(-dt * 10))
      return sample
    },
    get contextState() { return context?.state ?? 'idle' },
    get streams() { return [...decks].filter(deck => !deck.media.paused).length },
    get source() { return active ? MUSIC_MOODS[active.mood].src : '' },
    get time() { return active?.media.currentTime ?? 0 },
    get duration() { return active?.media.duration ?? 0 },
    dispose() {
      disposed = true; playing = false
      for (const deck of decks) destroy(deck)
      if (context) { context.onstatechange = null; void context.close() }
    },
  }
}
