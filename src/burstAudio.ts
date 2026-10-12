import { burstSoundProfile } from './burstSoundProfile'

const FILES = ['/audio/implosion-1.mp3', '/audio/implosion-2.mp3', '/audio/implosion-sm.mp3', '/audio/tiny-bubble-pop.wav']

export function createBurstAudio() {
  let context: AudioContext | undefined
  let buffers: Promise<AudioBuffer | null>[] = []
  let muted = false, disposed = false, variation = 0, epoch = 0, plays = 0
  let lastSound = ''
  const playing = new Set<AudioBufferSourceNode>()
  const files = FILES.map(path => fetch(path).then(response => {
    if (!response.ok) throw new Error(`Unable to load ${path}`)
    return response.arrayBuffer()
  }).catch(() => null))

  const unlock = () => {
    if (disposed) return
    if (!context) {
      context = new AudioContext()
      const audio = context
      buffers = files.map(file => file.then(data => data ? audio.decodeAudioData(data) : null).catch(() => null))
    }
    if (context.state === 'suspended') void context.resume().catch(() => {})
  }
  const play = (radius: number, isSphere: boolean) => {
    if (muted || disposed || !context || context.state !== 'running') return
    const requestEpoch = epoch, audio = context
    const profile = burstSoundProfile(radius, isSphere)
    const index = profile.kind === 'tiny' ? 3 : profile.kind === 'small' ? 2 : variation++ % 2
    void buffers[index].then(buffer => {
      if (!buffer || disposed || muted || requestEpoch !== epoch || audio.state !== 'running') return
      const source = audio.createBufferSource(), gain = audio.createGain()
      source.buffer = buffer
      gain.gain.value = profile.gain
      source.playbackRate.value = profile.rate * (.98 + Math.random() * .04)
      source.connect(gain); gain.connect(audio.destination)
      playing.add(source)
      source.onended = () => { playing.delete(source); source.disconnect(); gain.disconnect() }
      source.start(); plays++; lastSound = FILES[index]
    })
  }
  const stop = () => { epoch++; playing.forEach(source => source.stop()); playing.clear() }
  return {
    unlock, play, stop,
    setMuted(value: boolean) { muted = value; if (value) stop(); else unlock() },
    get plays() { return plays },
    get lastSound() { return lastSound },
    dispose() { disposed = true; stop(); void context?.close().catch(() => {}) },
  }
}
