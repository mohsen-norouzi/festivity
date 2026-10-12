const FILES = ['/audio/implosion-1.mp3', '/audio/implosion-2.mp3', '/audio/implosion-sm.mp3']

export function createBurstAudio() {
  let context: AudioContext | undefined
  let buffers: Promise<AudioBuffer | null>[] = []
  let muted = false, disposed = false, variation = 0, epoch = 0, plays = 0
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
  const play = (small: boolean) => {
    if (muted || disposed || !context || context.state !== 'running') return
    const requestEpoch = epoch, audio = context
    const index = small ? 2 : variation++ % 2
    void buffers[index].then(buffer => {
      if (!buffer || disposed || muted || requestEpoch !== epoch || audio.state !== 'running') return
      const source = audio.createBufferSource(), gain = audio.createGain()
      source.buffer = buffer
      gain.gain.value = small ? .58 : .68
      source.connect(gain); gain.connect(audio.destination)
      playing.add(source)
      source.onended = () => { playing.delete(source); source.disconnect(); gain.disconnect() }
      source.start(); plays++
    })
  }
  const stop = () => { epoch++; playing.forEach(source => source.stop()); playing.clear() }
  return {
    unlock, play, stop,
    setMuted(value: boolean) { muted = value; if (value) stop(); else unlock() },
    get plays() { return plays },
    dispose() { disposed = true; stop(); void context?.close().catch(() => {}) },
  }
}
