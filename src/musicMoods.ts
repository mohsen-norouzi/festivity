export const MUSIC_MOODS = {
  coral: { name: 'Golden hour', genre: 'Warm house', bpm: 96, root: 50, accent: '#ffb48c', deep: '#36213d', mid: '#944d64', light: '#f39780', secondary: '#d797d6', cutoff: 1900, pad: .75, rhythm: .85, melody: [0, 7, 10, 7, 3, 5, 12, 10] },
  ink: { name: 'After hours', genre: 'Deep groove', bpm: 104, root: 50, accent: '#95a9ff', deep: '#101426', mid: '#30385c', light: '#596bac', secondary: '#b579a3', cutoff: 1100, pad: .55, rhythm: 1, melody: [0, 0, 7, 3, 10, 7, 3, 5] },
  lilac: { name: 'Velvet dreams', genre: 'Dream electronica', bpm: 88, root: 50, accent: '#e0b1ff', deep: '#28223f', mid: '#765589', light: '#b991ce', secondary: '#ebaaa8', cutoff: 2300, pad: .9, rhythm: .55, melody: [12, 7, 10, 3, 7, 5, 15, 12] },
  pearl: { name: 'Slow morning', genre: 'Soft keys', bpm: 76, root: 50, accent: '#ffe5ba', deep: '#343043', mid: '#9a8188', light: '#ded1b9', secondary: '#b5abd9', cutoff: 2700, pad: .7, rhythm: .3, melody: [0, 7, 3, 10, 5, 12, 7, 3] },
  glass: { name: 'Prism drift', genre: 'Liquid electronica', bpm: 92, root: 50, accent: '#e5c4ff', deep: '#292644', mid: '#66638f', light: '#bfa9dc', secondary: '#90c3df', cutoff: 3100, pad: .8, rhythm: .6, melody: [12, 7, 15, 10, 19, 12, 7, 5] },
  blue: { name: 'Blue current', genre: 'Ocean beats', bpm: 84, root: 50, accent: '#a4d2ff', deep: '#1c2e48', mid: '#426783', light: '#8ab9d6', secondary: '#b5a5d4', cutoff: 1700, pad: 1, rhythm: .6, melody: [7, 12, 5, 3, 10, 7, 0, 5] },
  bubble: { name: 'Weightless', genre: 'Glass harmonics', bpm: 80, root: 50, accent: '#c3ecff', deep: '#283349', mid: '#6a8099', light: '#b3d3d9', secondary: '#d1afdb', cutoff: 3400, pad: .8, rhythm: .25, melody: [19, 12, 15, 7, 22, 19, 10, 12] },
} as const

export type MoodId = keyof typeof MUSIC_MOODS
export interface MusicState { mood: MoodId | null; playing: boolean; audible: boolean }
export type NoteEvent = { voice: 'pad' | 'key' | 'bass' | 'kick' | 'hat' | 'snare'; note: number; velocity: number; duration: number }
export const noteFrequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** Four related seventh chords share a key, so changing colors stays musical. */
export function musicStep(mood: MoodId, step: number): NoteEvent[] {
  const song = MUSIC_MOODS[mood], beat = 60 / song.bpm
  const bar = Math.floor(step / 8) % 4, eighth = step % 8
  const roots = [0, 3, -2, 5], root = song.root + roots[bar]
  const chord = bar === 1 ? [0, 4, 7, 11] : bar === 2 ? [0, 4, 7, 10] : [0, 3, 7, 10]
  const notes: NoteEvent[] = []
  if (eighth === 0) for (const interval of chord) notes.push({ voice: 'pad', note: root + interval, velocity: .021 * song.pad, duration: beat * 4 })
  if (eighth === 0 || eighth === 3 || eighth === 6) notes.push({ voice: 'bass', note: root - 12 + (eighth === 6 ? 7 : 0), velocity: .14, duration: beat * (eighth === 0 ? 1.3 : .7) })
  if (eighth % 2 === 0 || (bar % 2 === 1 && eighth === 5)) notes.push({ voice: 'key', note: song.root + 12 + song.melody[(eighth + bar * 3) % 8], velocity: eighth % 2 ? .045 : .075, duration: beat * 1.6 })
  if (eighth === 0 || eighth === 4 || (song.rhythm > .8 && eighth === 7)) notes.push({ voice: 'kick', note: 0, velocity: .28 * song.rhythm, duration: .3 })
  if (eighth === 2 || eighth === 6) notes.push({ voice: 'snare', note: 0, velocity: .075 * song.rhythm, duration: .14 })
  notes.push({ voice: 'hat', note: 0, velocity: (eighth % 2 ? .045 : .02) * song.rhythm, duration: eighth === 7 ? .11 : .045 })
  return notes
}
