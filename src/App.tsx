import { useEffect, useRef, useState } from 'react'
import { createOrnamentScene } from './scene'
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

  useEffect(() => {
    if (!host.current || !cursor.current) return
    try {
      scene.current = createOrnamentScene(host.current, cursor.current, () => setReady(true), () => setError(true))
    } catch (cause) {
      console.error('Unable to initialize the music sculpture', cause)
      setError(true)
    }
    return () => { scene.current?.dispose(); scene.current = null }
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

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { /* Some embedded previews disable the Fullscreen API. */ }
  }

  return (
    <main className={`hero relative isolate h-svh min-h-[440px] w-full overflow-hidden ${ready ? 'is-ready' : ''}`}>
      <div ref={host} className="scene absolute inset-0" role="img" aria-label="A floating sculpture of glass, ceramic, and satin music tiles in coral, lilac, pearl, and midnight blue. Move through the shapes or drag one to explore." />
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
        <p className="menu-hint">Move to push. Hold to pull.<br />Let go and watch it settle.</p>
      </div>}

      <div className="study-caption absolute z-10 pointer-events-none">
        <p className="font-semibold">Where Sound Takes Shape</p>
        <p>Artists &amp; Fans. Together.</p>
        <span className="caption-dash" />
      </div>

      <div className="interaction-label absolute z-10 pointer-events-none">
        <p className="desktop-hint">DRAG CURSOR TO INTERACT</p>
        <p className="touch-hint">TOUCH &amp; DRAG TO INTERACT</p>
        <span className={paused ? 'status-dot is-paused' : 'status-dot'} />
      </div>

      <button className="large-x display-font absolute z-10" onClick={scatter} aria-label="Scatter the shapes" title="Scatter the shapes">M</button>
      <div className="edition absolute z-10 flex items-center pointer-events-none" aria-label="Experiment 01"><span className="display-font">01</span><span className="edition-dash" /></div>

      <footer className="hero-footer absolute inset-x-0 bottom-0 z-20 flex items-end justify-between">
        <div className="material-caption"><p className="font-semibold">Made to Move You</p><p>A Study in Sound &amp; Connection</p></div>
        <h1 className="hero-title">MUSIC, IN MOTION</h1>
        <div className="simulation-controls flex items-center">
          <span className="simulation-label">{paused ? 'MOTION PAUSED' : 'LIVE SIMULATION'}</span>
          <button className="icon-button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume motion' : 'Pause motion'} title={paused ? 'Resume motion' : 'Pause motion'}><PauseIcon paused={paused} /></button>
          <button className="icon-button" onClick={reset} aria-label="Reset composition" title="Reset composition"><ResetIcon /></button>
          {document.fullscreenEnabled && <button className="icon-button fullscreen-button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}><ExpandIcon /></button>}
        </div>
      </footer>

      {!ready && !error && <div className="loading-state pointer-events-none absolute inset-0 flex items-center justify-center"><span>SETTING THE SCENE<span className="loading-dot">.</span></span></div>}
      {error && <div className="error-state absolute inset-0 z-10 flex items-center justify-center"><p>This experiment needs WebGL.<br /><span>Please enable hardware acceleration and reload.</span></p></div>}
      <span className="sr-only" role="status">{resetCount > 0 ? `Composition reset ${resetCount} ${resetCount === 1 ? 'time' : 'times'}.` : ''}</span>
    </main>
  )
}
