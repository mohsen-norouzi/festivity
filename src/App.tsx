import noteIcon from './assets/icons/music-notes-fill.svg'
import heartIcon from './assets/icons/heart-fill.svg'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MUSIC_MOODS, type MusicState } from './musicMoods'
import type { OrnamentScene } from './scene'

function PauseIcon({ paused }: { paused: boolean }) {
  return paused
    ? <svg viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor" stroke="none" /></svg>
    : <svg viewBox="0 0 20 20"><path d="M7 4v12M13 4v12" strokeWidth="2.5" /></svg>
}

function ResetIcon() {
  return <svg viewBox="0 0 20 20"><path d="M4.2 7.2a6 6 0 1 1-.1 5.3M4 3v4.5h4.5" /></svg>
}

function ExpandIcon() {
  return <svg viewBox="0 0 20 20"><path d="M7 3H3v4m10-4h4v4M3 13v4h4m6 0h4v-4" /></svg>
}

function SoundIcon({ enabled }: { enabled: boolean }) {
  return <svg viewBox="0 0 20 20"><path d="M9 4 5 7H2v6h3l4 3Z" />{enabled ? <path d="M12 6a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /> : <path d="m13 7 5 6m0-6-5 6" />}</svg>
}

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
  const [fullscreen, setFullscreen] = useState(false)
  const [resetCount, setResetCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [music, setMusic] = useState<MusicState>({ mood: null, playing: false, audible: false })
  const song = music.mood ? MUSIC_MOODS[music.mood] : null

  const preferences = useRef({ paused, soundEnabled })
  preferences.current = { paused, soundEnabled }

  useEffect(() => {
    let cancelled = false
    let instance: OrnamentScene | null = null
    // Let the small React shell paint before downloading / preparing Three.js.
    // Cancelling the scheduled work also avoids StrictMode's duplicate GPU setup.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(async () => {
        try {
          const { createOrnamentScene } = await import('./scene')
          if (cancelled || !host.current || !cursor.current) return
          instance = createOrnamentScene(host.current, cursor.current,
            () => { if (!cancelled) setReady(true) },
            () => { if (!cancelled) setError(true) },
            state => { if (!cancelled) setMusic(state) })
          scene.current = instance
          instance.setPaused(preferences.current.paused)
          if (!preferences.current.soundEnabled) instance.setSoundEnabled(false)
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
    const handleFullscreen = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreen)
    return () => document.removeEventListener('fullscreenchange', handleFullscreen)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
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

  const scatter = () => {
    scene.current?.setPaused(false)
    setPaused(false)
    scene.current?.scatter()
  }

  const toggleSound = () => {
    scene.current?.setSoundEnabled(!soundEnabled)
    setSoundEnabled(value => !value)
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { /* Some embedded previews disable the Fullscreen API. */ }
  }

  return (
    <main className={`hero relative isolate h-svh min-h-[440px] w-full overflow-hidden ${ready ? 'is-ready' : ''} ${paused ? 'is-paused' : ''} ${music.audible ? 'is-music-playing' : ''} ${song ? 'has-music' : ''}`} style={{ '--mood-accent': song?.accent ?? '#e5c4ff' } as CSSProperties}>
      <div ref={host} className="scene absolute inset-0" role="img" aria-label="An interactive sculpture of glass bubbles and music tiles. Click a shape to toggle its music and symbol animation. Every click also inflates it; five clicks pop it. Drag to move; a matching replacement floats in." />
      <div className="grain pointer-events-none absolute inset-0" aria-hidden="true" />
      <div ref={cursor} className="scene-cursor pointer-events-none" aria-hidden="true"><span /></div>

      <header className="hero-header absolute inset-x-0 top-0 z-20 flex items-center justify-between">
        <button className="wordmark display-font" onClick={reset} aria-label="Festivity — reset the scene">FESTIVITY</button>
        <div className="study-index hidden items-center justify-between md:flex" aria-label="A study of sound, artists, connection, culture, and play">
          <span>SOUND</span><span>ARTISTS</span><span>CONNECTION</span><span>CULTURE</span><span>PLAYGROUND</span>
        </div>
        <button ref={menuButton} className={`menu-button icon-button ${menuOpen ? 'is-open' : ''}`} aria-label={menuOpen ? 'Close experiment controls' : 'Open experiment controls'} aria-expanded={menuOpen} aria-controls="experiment-controls" onClick={() => setMenuOpen(open => !open)}>
          <span /><span /><span />
        </button>
      </header>

      {menuOpen && <div id="experiment-controls" ref={menu} className="control-menu absolute z-30">
        <p className="menu-eyebrow">EXPERIMENT 001</p>
        <button onClick={() => setPaused(value => !value)}><span>{paused ? 'Resume motion' : 'Pause motion'}</span><PauseIcon paused={paused} /></button>
        <button onClick={reset}><span>Reset composition</span><ResetIcon /></button>
        <button onClick={scatter}><span>Scatter shapes</span><span aria-hidden="true">↗</span></button>
        <p className="menu-hint">Click to toggle a shape’s music and animation.<br />Every click adds air. Five clicks pop it. Drag to move.</p>
      </div>}

      <div className="study-caption absolute z-10 pointer-events-none">
        <p className="font-semibold">Where Sound Takes Shape</p>
        <p>Artists &amp; Fans. Together.</p>
        <span className="caption-dash" />
      </div>

      <div className="interaction-label absolute z-10 pointer-events-none">
        <p className="desktop-hint">CLICK TO LISTEN · DRAG TO MOVE</p>
        <p className="touch-hint">TAP TO LISTEN · DRAG TO MOVE</p>
        <span className={paused ? 'status-dot is-paused' : 'status-dot'} />
      </div>

      <div className="floating-card community-card" aria-label="Artists and fans, closer through music">
        <div className="avatar-pair" aria-hidden="true"><span><img src={noteIcon} alt="" /></span><span><img src={heartIcon} alt="" /></span></div>
        <p><strong>Artists × fans</strong><span>Closer through music</span></p>
      </div>
      <button className="floating-card explore-card music-player" onClick={() => scene.current?.toggleMusic()} aria-label={music.playing ? 'Pause music' : 'Play music'} aria-pressed={music.playing}>
        <span className="music-meter" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span className="music-copy">
          <span className="music-eyebrow">{song ? music.playing ? music.audible ? 'NOW PLAYING' : 'SOUND OFF' : 'PAUSED' : 'FIND YOUR FREQUENCY'}</span>
          <strong>{song?.name ?? 'Explore the sound'}</strong>
          <span className="music-subtitle">{song ? `${song.genre} · ${song.bpm} BPM` : 'Click a shape to toggle'}</span>
        </span>
        <span className="card-action" aria-hidden="true"><PauseIcon paused={!music.playing} /></span>
      </button>
      <div className="floating-card together-card">
        <span className="connection-mark" aria-hidden="true"><i /><i /><i /></span>
        <p><strong>Independent.</strong><span>Together.</span></p>
        <span className="together-star" aria-hidden="true">✳</span>
      </div>

      <button className="large-x display-font absolute z-10" onClick={scatter} aria-label="Scatter the shapes" title="Scatter the shapes">M</button>
      <div className="edition absolute z-10 flex items-center pointer-events-none" aria-label="Experiment 01"><span className="display-font">01</span><span className="edition-dash" /></div>

      <footer className="hero-footer absolute inset-x-0 bottom-0 z-20 flex items-end justify-between">
        <div className="material-caption"><p className="font-semibold">Made to Move You</p><p>A Study in Sound &amp; Connection</p></div>
        <h1 className="hero-title">MUSIC, IN MOTION</h1>
        <div className="simulation-controls flex items-center">
          <span className="simulation-label">{paused ? 'MOTION PAUSED' : 'LIVE SIMULATION'}</span>
          <button className="icon-button" onClick={toggleSound} aria-label={soundEnabled ? 'Mute all audio' : 'Enable audio'} aria-pressed={soundEnabled} title={soundEnabled ? 'Mute all audio' : 'Enable audio'}><SoundIcon enabled={soundEnabled} /></button>
          <button className="icon-button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume motion' : 'Pause motion'} title={paused ? 'Resume motion' : 'Pause motion'}><PauseIcon paused={paused} /></button>
          <button className="icon-button" onClick={reset} aria-label="Reset composition" title="Reset composition"><ResetIcon /></button>
          {document.fullscreenEnabled && <button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}><ExpandIcon /></button>}
        </div>
      </footer>

      {!ready && !error && <div className="entrance-signal pointer-events-none" role="status" aria-label="The sculpture is arriving"><i /><i /><i /><i /><i /></div>}
      {error && <div className="error-state absolute inset-0 z-10 flex items-center justify-center"><p>This experiment needs WebGL.<br /><span>Please enable hardware acceleration and reload.</span></p></div>}
      <span className="sr-only" role="status">{resetCount > 0 ? `Composition reset ${resetCount} ${resetCount === 1 ? 'time' : 'times'}.` : ''}</span>
    </main>
  )
}
