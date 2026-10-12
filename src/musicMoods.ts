const song = (artist: string, name: string) => ({ artist, name, src: `/songs/${encodeURIComponent(`${artist} - ${name}.mp3`)}` })

/** One local recording per material; the original scene palettes stay the same. */
export const MUSIC_MOODS = {
  coral: { ...song('Moavii', 'Sunshine'), accent: '#ffb48c', deep: '#36213d', mid: '#944d64', light: '#f39780', secondary: '#d797d6' },
  ink: { ...song('Tetuano', 'Wavy Strut'), accent: '#95a9ff', deep: '#101426', mid: '#30385c', light: '#596bac', secondary: '#b579a3' },
  lilac: { ...song('NVL8', 'Pink Clouds'), accent: '#e0b1ff', deep: '#28223f', mid: '#765589', light: '#b991ce', secondary: '#ebaaa8' },
  pearl: { ...song('Pufino', 'Enjoy'), accent: '#ffe5ba', deep: '#343043', mid: '#9a8188', light: '#ded1b9', secondary: '#b5abd9' },
  glass: { ...song('Johny Grimes', "That's Life"), accent: '#e5c4ff', deep: '#292644', mid: '#66638f', light: '#bfa9dc', secondary: '#90c3df' },
  blue: { ...song('Unheard', 'Back To Promise'), accent: '#a4d2ff', deep: '#1c2e48', mid: '#426783', light: '#8ab9d6', secondary: '#b5a5d4' },
  bubble: { ...song('Pufino', 'Tariro'), accent: '#c3ecff', deep: '#283349', mid: '#6a8099', light: '#b3d3d9', secondary: '#d1afdb' },
} as const

export type MoodId = keyof typeof MUSIC_MOODS
export interface MusicState { mood: MoodId | null; playing: boolean; audible: boolean; loading?: boolean; error?: boolean }
