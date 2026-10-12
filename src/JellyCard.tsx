import { useEffect, useRef, type ReactNode } from 'react'

/** DOM lettering stays crisp; a transparent capsule gently deforms around it. */
export function JellyCard({ className, children }: { className: string; children: ReactNode }) {
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = anchor.current!
    const surface = element.firstElementChild as HTMLElement
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const position = [0, 0, 0]
    const velocity = [0, 0, 0]
    const target = [0, 0, 0]
    let frame = 0
    let previous = 0
    let bounds: DOMRect | null = null

    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 1 / 30)
      previous = now
      let moving = false
      for (let i = 0; i < 3; i++) {
        velocity[i] += ((target[i] - position[i]) * (i === 2 ? 290 : 180) - velocity[i] * (i === 2 ? 13 : 18)) * dt
        position[i] += velocity[i] * dt
        if (Math.abs(velocity[i]) > .0005 || Math.abs(target[i] - position[i]) > .0001) moving = true
      }
      surface.style.setProperty('--lean-x', `${position[0].toFixed(3)}deg`)
      surface.style.setProperty('--lean-y', `${position[1].toFixed(3)}deg`)
      surface.style.setProperty('--squish', position[2].toFixed(5))
      surface.style.setProperty('--bend', `${(position[1] * .7).toFixed(3)}%`)
      frame = moving ? requestAnimationFrame(tick) : 0
    }
    const wake = () => {
      if (reduced.matches || frame) return
      previous = performance.now()
      frame = requestAnimationFrame(tick)
    }
    const enter = () => { bounds = element.getBoundingClientRect() }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reduced.matches) return
      bounds ??= element.getBoundingClientRect()
      target[0] = -((event.clientY - bounds.top) / bounds.height - .5) * 6
      target[1] = ((event.clientX - bounds.left) / bounds.width - .5) * 8
      wake()
    }
    const release = () => { target[2] = 0; wake() }
    const leave = () => { target.fill(0); bounds = null; wake() }
    const press = () => { target[2] = .022; velocity[2] += .15; wake() }
    const keyDown = (event: KeyboardEvent) => { if (!event.repeat && ['Enter', ' '].includes(event.key)) press() }
    const keyUp = (event: KeyboardEvent) => { if (['Enter', ' '].includes(event.key)) release() }
    const preference = () => {
      if (!reduced.matches) return
      cancelAnimationFrame(frame); frame = 0
      position.fill(0); velocity.fill(0); target.fill(0)
      surface.style.setProperty('--lean-x', '0deg')
      surface.style.setProperty('--lean-y', '0deg')
      surface.style.setProperty('--squish', '0')
      surface.style.setProperty('--bend', '0%')
    }
    element.addEventListener('pointerenter', enter)
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerdown', press)
    element.addEventListener('pointerup', release)
    element.addEventListener('pointercancel', leave)
    element.addEventListener('pointerleave', leave)
    element.addEventListener('keydown', keyDown)
    element.addEventListener('keyup', keyUp)
    element.addEventListener('focusout', leave)
    reduced.addEventListener('change', preference)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('pointerenter', enter)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerdown', press)
      element.removeEventListener('pointerup', release)
      element.removeEventListener('pointercancel', leave)
      element.removeEventListener('pointerleave', leave)
      element.removeEventListener('keydown', keyDown)
      element.removeEventListener('keyup', keyUp)
      element.removeEventListener('focusout', leave)
      reduced.removeEventListener('change', preference)
    }
  }, [])

  return <div ref={anchor} className={`jelly-anchor ${className}`}>{children}</div>
}
