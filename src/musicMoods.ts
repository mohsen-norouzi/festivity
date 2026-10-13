const song = (artist: string, name: string) => ({ artist, name, src: `/songs/${encodeURIComponent(`${artist} - ${name}.mp3`)}` })

/** One local recording per material; colored stage lights complement the luminous peach/violet haze. */
export const MUSIC_MOODS = {
  coral: { ...song('Moavii', 'Sunshine'), accent: '#ffb395', deep: '#65354c', mid: '#a7697e', light: '#ffc08c', secondary: '#e996c2' },
  ink: { ...song('Tetuano', 'Wavy Strut'), accent: '#c3b7ef', deep: '#383853', mid: '#79698f', light: '#a3b5ef', secondary: '#edafae' },
  lilac: { ...song('NVL8', 'Pink Clouds'), accent: '#ff9cdb', deep: '#643a6e', mid: '#af70ab', light: '#f3a0db', secondary: '#a9a1e8' },
  pearl: { ...song('Pufino', 'Enjoy'), accent: '#ffe2bc', deep: '#715261', mid: '#bb959d', light: '#ffe0ad', secondary: '#dba8d8' },
  glass: { ...song('Johny Grimes', "That's Life"), accent: '#ffc0b3', deep: '#665175', mid: '#af81a1', light: '#ffc596', secondary: '#cbb0ef' },
  blue: { ...song('Unheard', 'Back To Promise'), accent: '#ccb3ff', deep: '#484971', mid: '#897fb1', light: '#c7b3f2', secondary: '#e5a7c9' },
  bubble: { ...song('Pufino', 'Tariro'), accent: '#f3d9ff', deep: '#615273', mid: '#a593b9', light: '#ead0e9', secondary: '#b5c7ed' },
} as const

export type MoodId = keyof typeof MUSIC_MOODS
export interface MusicState { mood: MoodId | null; playing: boolean; audible: boolean; loading?: boolean; error?: boolean }
