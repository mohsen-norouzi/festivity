import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MUSIC_MOODS, type MoodId, type MusicState } from './musicMoods'
import type { OrnamentScene } from './scene'
import { JellyCard } from './JellyCard'

function PauseIcon({ paused }: { paused: boolean }) {
  return paused
    ? <svg viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor" stroke="none" /></svg>
    : <svg viewBox="0 0 20 20"><path d="M7 4v12M13 4v12" strokeWidth="2.5" /></svg>
}

const tracks = Object.entries(MUSIC_MOODS) as [MoodId, (typeof MUSIC_MOODS)[MoodId]][]

export default function App() {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<OrnamentScene | null>(null)
  const cursor = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [menuOpen, setMenuOpen] = useState(false)
  const [resetCount, setResetCount] = useState(0)
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [discoveryCount, setDiscoveryCount] = useState(0)
  const discoveryDeck = useRef<MoodId[]>([])
  const [music, setMusic] = useState<MusicState>({ mood: null, playing: false, audible: false })
  const song = music.mood ? MUSIC_MOODS[music.mood] : null

  const preferences = useRef({ paused })
  preferences.current = { paused }

  useEffect(() => {
    let cancelled = false
    let instance: OrnamentScene | null = null
    // Let the small React shell paint before downloading / preparing Three.js.
    // Cancelling the scheduled work also avoids StrictMode's duplicate GPU setup.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(async () => {
        try {
          const { createOrnamentScene } = await import('./scene')
          await document.fonts.load('16px "Permanent Marker"').catch(() => [])
          if (cancelled || !host.current || !cursor.current) return
          instance = createOrnamentScene(host.current, cursor.current,
            () => { if (!cancelled) setReady(true) },
            () => { if (!cancelled) setError(true) },
            state => { if (!cancelled) setMusic(state) })
          scene.current = instance
          instance.setPaused(preferences.current.paused)
        } catch (cause) {
          if (cancelled) return
          console.error('Unable to initialize the music sculpture', cause)
          setError(true)
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      instance?.dispose()
      if (scene.current === instance) scene.current = null
    }
  }, [])

  useEffect(() => { scene.current?.setPaused(paused) }, [paused])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setPaused(preference.matches)
    preference.addEventListener('change', onChange)
    return () => preference.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const currentTrack = menu.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    ;(currentTrack ?? menu.current?.querySelector<HTMLButtonElement>('button'))?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus() }
    }
    const onPointer = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !menuButton.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [menuOpen])

  const reset = () => {
    scene.current?.reset()
    setResetCount(count => count + 1)
  }

  const scatter = () => scene.current?.scatter()
  const discover = () => {
    if (!ready || !scene.current) return
    // Draw without repeating until the remaining tracks have all had a turn.
    let remaining = discoveryDeck.current.filter(id => id !== music.mood)
    if (!remaining.length) remaining = tracks.map(([id]) => id).filter(id => id !== music.mood)
    const index = Math.floor(Math.random() * remaining.length)
    const [next] = remaining.splice(index, 1)
    discoveryDeck.current = remaining
    scene.current.selectTrack(next)
    setDiscoveryCount(count => count + 1)
  }

  return (
    <main className={`hero relative isolate h-svh min-h-[440px] w-full overflow-hidden ${ready ? 'is-ready' : ''} ${paused ? 'is-paused' : ''} ${music.audible ? 'is-music-playing' : ''} ${song ? 'has-music' : ''}`} style={{ '--mood-accent': song?.accent ?? '#ffc0b3' } as CSSProperties}>
      <div ref={host} className="scene absolute inset-0" role="img" aria-label="A luminous music sculpture of glass, painted music tiles, and a live concert image. Click a shape once to play its music and inflate it until it pops. Repeated clicks keep the music playing; another shape selects its track. Drag to move; a matching replacement floats in." />
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />
      <div ref={cursor} className="scene-cursor pointer-events-none" aria-hidden="true"><span /></div>

      <header className="hero-header absolute inset-x-0 top-0 z-20 flex items-center justify-between">
        <button className="wordmark" onClick={reset} aria-label="MUSYNC — reset the scene"><img src="/brand/musync-logo-white.svg" alt="MUSYNC" width="429" height="109" /></button>
        <div className="study-index hidden items-center justify-between md:flex" aria-label="An ecosystem for artists, fans, and Dream Movers">
          <span>ARTISTS</span><span>FANS</span><span>DREAM MOVERS</span><span>OWNERSHIP</span><span>CONNECTION</span>
        </div>
        <button ref={menuButton} className={`menu-button icon-button ${menuOpen ? 'is-open' : ''}`} aria-label={menuOpen ? 'Close the MUSYNC mix' : 'Explore the MUSYNC mix'} aria-expanded={menuOpen} aria-controls="musync-mix" onClick={() => setMenuOpen(open => !open)}>
          <span /><span /><span />
        </button>
      </header>

      {menuOpen && <div id="musync-mix" ref={menu} className="mix-menu absolute z-30" role="region" aria-labelledby="mix-heading">
        <div className="mix-heading">
          <p className="mix-eyebrow"><span /> THE MUSYNC MIX <span className="mix-count">01—07</span></p>
          <h2 id="mix-heading">Find your<br /><span>frequency.</span></h2>
          <p className="mix-intro">Pick a track. Watch it take shape.</p>
        </div>
        <ul className="mix-tracks" aria-label="Choose a track" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
          if (index < 0) return
          event.preventDefault()
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          buttons[next]?.focus()
        }}>
          {tracks.map(([id, track], index) => {
            const selected = music.mood === id
            const isPlaying = selected && music.playing
            return <li key={id}>
              <button className={`mix-track ${selected ? 'is-selected' : ''} ${selected && music.audible ? 'is-playing' : ''}`} style={{ '--track-accent': track.accent, '--track-deep': track.deep } as CSSProperties} disabled={!ready} onClick={() => scene.current?.selectTrack(id)} aria-label={`${isPlaying ? 'Pause' : 'Play'} ${track.name} by ${track.artist}`} aria-pressed={isPlaying}>
                <span className={`track-art track-art-${id}`} aria-hidden="true"><img src="/brand/musync-symbol-white.svg" alt="" /></span>
                <span className="track-copy"><strong>{track.name}</strong><span>{track.artist}</span></span>
                <span className="track-tail" aria-hidden="true"><span className="track-number">{String(index + 1).padStart(2, '0')}</span><span className="track-bars"><i /><i /><i /></span><span className="track-play"><PauseIcon paused={!isPlaying} /></span></span>
              </button>
            </li>
          })}
        </ul>
        <a className="mix-invitation" href="https://www.musync.me/en/#apply" target="_blank" rel="noopener noreferrer"><span>Closer to your artists.</span><span>Join MUSYNC <span aria-hidden="true">↗</span></span></a>
      </div>}

      <div className="study-caption absolute z-10 pointer-events-none">
        <h1><span>THE</span><span>MUSIC</span><span>IS <em>OURS.</em></span></h1>
        <p className="caption-manifesto">Real music. Real connection.<br />Artists and fans.<br />Together.</p>
      </div>

      <div className="interaction-label absolute z-10 pointer-events-none">
        <p className="desktop-hint">CLICK TO LISTEN · DRAG TO MOVE</p>
        <p className="touch-hint">TAP TO LISTEN · DRAG TO MOVE</p>
        <span className={paused ? 'status-dot is-paused' : 'status-dot'} />
      </div>

      <JellyCard className="connection-jelly">
        <button className="jelly-surface glass-pill" onClick={() => setConnectionOpen(open => !open)} aria-expanded={connectionOpen} aria-controls="connection-details" aria-label={connectionOpen ? 'Close the MUSYNC connection details' : 'Why MUSYNC? Discover the artist–fan connection'}>
          <svg className="pill-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 8 2-2a5 5 0 0 1 7 7l-2 2M15 16l-2 2a5 5 0 0 1-7-7l2-2M8 16l8-8" /></svg>
          <span className="pill-copy" id="connection-details"><strong>{connectionOpen ? 'Real-time royalties' : 'Artists & fans'}</strong><span>{connectionOpen ? 'Transparent collaborations' : 'Connected. Directly.'}</span></span>
          <span className="pill-action" aria-hidden="true">{connectionOpen ? '−' : '+'}</span>
        </button>
      </JellyCard>
      <JellyCard className="discovery-jelly">
        <button className="jelly-surface glass-pill" disabled={!ready} onClick={discover} aria-label="Surprise me — play a different track">
          <svg className="pill-symbol" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 9h3c5 0 9 14 14 14h3m-5-5 5 5-5 5M6 23h3c2 0 4-3 6-7m3-5c2-2 3-2 5-2h3m-5-5 5 5-5 5" /></svg>
          <span className="pill-copy"><strong>Surprise me</strong><span>{music.loading && discoveryCount > 0 ? 'Finding your sound…' : 'Discover a new track'}</span></span>
          <span className="pill-action" aria-hidden="true">↗</span>
        </button>
      </JellyCard>
      <JellyCard className="invitation-jelly">
        <a className="jelly-surface glass-pill" href="https://www.musync.me/en/#apply" target="_blank" rel="noopener noreferrer" aria-label="Join MUSYNC — open the waitlist">
          <img className="pill-brand" src="/brand/musync-symbol-white.svg" alt="" aria-hidden="true" />
          <span className="pill-copy"><strong>Join MUSYNC</strong><span>Meet your next chapter</span></span>
          <span className="pill-action" aria-hidden="true">↗</span>
        </a>
      </JellyCard>

      <button className="large-x brand-symbol absolute z-10" onClick={scatter} aria-label="Scatter the shapes" title="Scatter the shapes"><img src="/brand/musync-symbol-white.svg" alt="" width="96" height="109" /></button>
      <div className="edition absolute z-10 flex items-center pointer-events-none" aria-label="Experiment 01"><span className="display-font">01</span><span className="edition-dash" /></div>

      <footer className="hero-footer absolute inset-x-0 bottom-0 z-20 flex items-end justify-between">
        <div className="material-caption"><p className="font-semibold">No middlemen.</p><p>Closer to your fans.</p></div>
        <p className="hero-title">MUSIC, IN MOTION.</p>
        <div className="rotation-note">
          <span className="rotation-record" aria-hidden="true"><span /><i /></span>
          <div className="rotation-copy">
            <p className="rotation-eyebrow">{music.audible ? 'NOW SPINNING' : song ? 'ON YOUR FREQUENCY' : 'THE MUSYNC MIX'}<span>{song ? `${String(tracks.findIndex(([id]) => id === music.mood) + 1).padStart(2, '0')} / 07` : '07 TRACKS'}</span></p>
            <p className="rotation-title">{song?.name ?? 'Your next favorite is here.'}</p>
            <p className="rotation-artist">{song?.artist ?? 'Choose a shape. Find your sound.'}</p>
          </div>
        </div>
      </footer>

      {!ready && !error && <div className="entrance-signal pointer-events-none" role="status" aria-label="The sculpture is arriving"><i /><i /><i /><i /><i /></div>}
      {error && <div className="error-state absolute inset-0 z-10 flex items-center justify-center"><p>This experiment needs WebGL.<br /><span>Please enable hardware acceleration and reload.</span></p></div>}
      <span className="sr-only" role="status">{discoveryCount > 0 && song ? `${music.loading ? 'Loading' : music.error ? 'Unable to play' : music.playing ? 'Playing' : 'Paused'} ${song.name} by ${song.artist}.` : ''}</span>
      <span className="sr-only" role="status">{resetCount > 0 ? `Composition reset ${resetCount} ${resetCount === 1 ? 'time' : 'times'}.` : ''}</span>
    </main>
  )
}
