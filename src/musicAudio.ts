import { MUSIC_MOODS, musicStep, noteFrequency, type MoodId, type MusicState, type NoteEvent } from './musicMoods'

type Group = { mood: MoodId; bus: GainNode; sources: Set<AudioScheduledSourceNode>; step: number; next: number; start: number; retired: boolean; disconnect: () => void; cleanup?: ReturnType<typeof setTimeout> }

/** A small, gesture-started score. One transport, with at most two crossfading mixes. */
export function createMusicAudio(onState: (state: MusicState) => void, makeContext = () => new AudioContext()) {
  let context: AudioContext | undefined, master: GainNode, analyser: AnalyserNode
  let noise: AudioBuffer, data: Float32Array<ArrayBuffer>
  let mood: MoodId | null = null, playing = false, muted = false, hidden = false, disposed = false
  let active: Group | undefined, timer: ReturnType<typeof setInterval> | undefined
  const groups = new Set<Group>()
  const sample = { energy: 0, beat: 0, phase: 0, time: 0 }
  let notes = 0
  const publish = () => onState({ mood, playing, audible: playing && !muted && !hidden && context?.state === 'running' })
  const initialize = () => {
    if (context) return context
    const ctx = context = makeContext()
    master = ctx.createGain(); master.gain.value = .65
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -16; compressor.knee.value = 18; compressor.ratio.value = 3
    compressor.attack.value = .015; compressor.release.value = .3
    analyser = ctx.createAnalyser(); analyser.fftSize = 512
    data = new Float32Array(analyser.fftSize)
    master.connect(compressor); compressor.connect(analyser); analyser.connect(ctx.destination)
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const channel = noise.getChannelData(0)
    for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1
    ctx.onstatechange = publish
    return ctx
  }
  const destroy = (group: Group) => {
    if (group.cleanup) clearTimeout(group.cleanup)
    group.sources.forEach(source => { try { source.stop() } catch { /* Already ended. */ } })
    group.disconnect(); groups.delete(group)
  }
  const retire = (group: Group, duration = .65) => {
    if (!context || group.retired) return
    group.retired = true
    const at = context.currentTime
    group.bus.gain.cancelAndHoldAtTime(at)
    group.bus.gain.linearRampToValueAtTime(0, at + duration)
    group.sources.forEach(source => { try { source.stop(at + duration) } catch { /* Already ended. */ } })
    group.cleanup = setTimeout(() => destroy(group), (duration + .1) * 1000)
  }
  const voice = (group: Group, event: NoteEvent, at: number) => {
    const ctx = context!, song = MUSIC_MOODS[group.mood]
    if (group.sources.size >= 80) return
    const gain = ctx.createGain(), filter = ctx.createBiquadFilter()
    const isNoise = event.voice === 'hat' || event.voice === 'snare'
    const source = isNoise ? ctx.createBufferSource() : ctx.createOscillator()
    const pad = event.voice === 'pad', kick = event.voice === 'kick'
    const attack = pad ? .3 : .006, release = pad ? .85 : .08
    const end = at + event.duration + release
    filter.type = isNoise ? 'highpass' : 'lowpass'
    filter.frequency.value = isNoise ? (event.voice === 'hat' ? 7500 : 1400) : song.cutoff
    filter.Q.value = .5
    if (isNoise) (source as AudioBufferSourceNode).buffer = noise
    else {
      const oscillator = source as OscillatorNode
      oscillator.type = pad || event.voice === 'bass' ? 'triangle' : 'sine'
      oscillator.frequency.setValueAtTime(kick ? 125 : noteFrequency(event.note), at)
      if (kick) oscillator.frequency.exponentialRampToValueAtTime(43, at + .16)
      if (pad) oscillator.detune.value = event.note % 2 ? 4 : -4
    }
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(event.velocity, at + attack)
    if (pad) {
      gain.gain.linearRampToValueAtTime(event.velocity * .7, at + event.duration)
      gain.gain.linearRampToValueAtTime(0, end)
    } else {
      gain.gain.exponentialRampToValueAtTime(.0001, end)
      gain.gain.linearRampToValueAtTime(0, end + .01)
    }
    source.connect(filter); filter.connect(gain); gain.connect(group.bus)
    group.sources.add(source)
    source.onended = () => { group.sources.delete(source); source.disconnect(); gain.disconnect(); filter.disconnect() }
    source.start(at); source.stop(end + .02)
    notes++
  }
  const pump = () => {
    if (!active || !context || context.state !== 'running') return
    const group = active, eighth = 30 / MUSIC_MOODS[group.mood].bpm
    // Never replay a backlog after an interrupted browser audio clock.
    if (group.next < context.currentTime - .2) group.next = context.currentTime + .02
    while (group.next < context.currentTime + .12) {
      for (const event of musicStep(group.mood, group.step)) voice(group, event, group.next)
      group.step = (group.step + 1) % 32
      group.next += eighth
    }
  }
  const stop = () => {
    if (timer) clearInterval(timer)
    timer = undefined
    if (active) retire(active, .22)
    active = undefined
  }
  const start = () => {
    if (!mood || !playing || muted || hidden || disposed) return
    const ctx = initialize()
    // resume is invoked synchronously inside the click gesture.
    void ctx.resume().then(() => { if (!disposed) { pump(); publish() } }).catch(() => { if (!disposed) { playing = false; stop(); publish() } })
    if (active?.mood === mood) { publish(); return }
    const old = active
    if (old) retire(old)
    while (groups.size >= 2) destroy(groups.values().next().value!)
    const bus = ctx.createGain()
    bus.gain.setValueAtTime(0, ctx.currentTime)
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + .6)
    bus.connect(master)
    // A quiet dotted-eighth echo gives the notes space without loading audio assets.
    const delay = ctx.createDelay(2), feedback = ctx.createGain(), wet = ctx.createGain()
    delay.delayTime.value = 45 / MUSIC_MOODS[mood].bpm
    feedback.gain.value = .24; wet.gain.value = .19
    bus.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(master)
    const startAt = ctx.currentTime + .025
    const group: Group = {
      mood, bus, sources: new Set(), step: 0, next: startAt, start: startAt, retired: false,
      disconnect() { bus.disconnect(); delay.disconnect(); feedback.disconnect(); wet.disconnect() },
    }
    groups.add(group); active = group
    if (!timer) timer = setInterval(pump, 25)
    pump(); publish()
  }
  return {
    select(value: MoodId) { if (disposed) return; mood = value; playing = true; start(); publish() },
    toggle() { if (disposed) return; playing = !playing; if (playing) { mood ??= 'glass'; start() } else stop(); publish() },
    setMuted(value: boolean) { muted = value; if (value) stop(); else start(); publish() },
    setHidden(value: boolean) { hidden = value; if (value) stop(); else start(); publish() },
    reset() { mood = null; playing = false; stop(); publish() },
    sample() {
      let energy = 0
      if (context?.state === 'running' && active) {
        analyser.getFloatTimeDomainData(data)
        for (const value of data) energy += value * value
        energy = Math.min(1, Math.sqrt(energy / data.length) * 10)
        const beat = 60 / MUSIC_MOODS[active.mood].bpm
        sample.time = Math.max(0, context.currentTime - active.start)
        sample.phase = (sample.time % beat) / beat
        sample.beat = Math.exp(-sample.phase * beat * 7)
      } else sample.beat = 0
      sample.energy += (energy - sample.energy) * .16
      return sample
    },
    get contextState() { return context?.state ?? 'idle' },
    get voices() { let total = 0; groups.forEach(group => { total += group.sources.size }); return total },
    get scheduledNotes() { return notes },
    dispose() {
      disposed = true; playing = false; stop()
      groups.forEach(destroy)
      if (context) { context.onstatechange = null; void context.close() }
    },
  }
}
