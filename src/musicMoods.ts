const song = (artist: string, name: string) => ({ artist, name, src: `/songs/${encodeURIComponent(`${artist} - ${name}.mp3`)}` })

/** One local recording per material; colored light is restrained against the underground venue. */
export const MUSIC_MOODS = {
  coral: { ...song('Moavii', 'Sunshine'), accent: '#ff784b', deep: '#170f0c', mid: '#79311e', light: '#f35222', secondary: '#a8475f' },
  ink: { ...song('Tetuano', 'Wavy Strut'), accent: '#bca48d', deep: '#080d11', mid: '#26333d', light: '#a2bed2', secondary: '#d06435' },
  lilac: { ...song('NVL8', 'Pink Clouds'), accent: '#eb60b4', deep: '#120d17', mid: '#642049', light: '#d73495', secondary: '#7e70af' },
  pearl: { ...song('Pufino', 'Enjoy'), accent: '#e6ccaa', deep: '#14110c', mid: '#67513d', light: '#d3ae78', secondary: '#b75531' },
  glass: { ...song('Johny Grimes', "That's Life"), accent: '#f1996a', deep: '#100e0b', mid: '#573026', light: '#f26c36', secondary: '#6787a6' },
  blue: { ...song('Unheard', 'Back To Promise'), accent: '#8fb8d5', deep: '#0b1117', mid: '#243e50', light: '#568caf', secondary: '#9e5539' },
  bubble: { ...song('Pufino', 'Tariro'), accent: '#e1bf9b', deep: '#13100e', mid: '#614734', light: '#b99166', secondary: '#6e98b5' },
} as const

export type MoodId = keyof typeof MUSIC_MOODS
export interface MusicState { mood: MoodId | null; playing: boolean; audible: boolean; loading?: boolean; error?: boolean }
