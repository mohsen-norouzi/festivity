export type JourneyPhase = 'idle' | 'ascending' | 'popped'
export const JOURNEY_LIFT_DELAY = .6
export const JOURNEY_ARRIVAL = 3.7
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return clamp(t * t * t * (t * (t * 6 - 15) + 10)) }

/** One visible-time clock drives the balloon, camera, DOM page, and immediate arrival pop. */
export function createBalloonJourney(onPhase: (phase: JourneyPhase) => void = () => {}) {
  const state = { phase: 'idle' as JourneyPhase, index: -1, age: 0, travel: 0, rise: 0, growth: 0 }
  const phase = (next: JourneyPhase) => { if (state.phase !== next) { state.phase = next; onPhase(next) } }
  const sample = () => {
    state.travel = smooth((state.age - JOURNEY_LIFT_DELAY) / (JOURNEY_ARRIVAL - JOURNEY_LIFT_DELAY))
    const progress = clamp(state.age / JOURNEY_ARRIVAL)
    // Ease into lift, but retain upward velocity right through the burst.
    state.rise = progress * progress * (2 - progress)
    state.growth = progress * progress * (3 - 2 * progress)
    if (state.age >= JOURNEY_ARRIVAL) phase('popped')
  }
  return {
    state,
    start(index: number, reducedMotion = false) {
      if (state.phase !== 'idle' || !Number.isInteger(index) || index < 0) return false
      state.index = index; state.age = reducedMotion ? JOURNEY_ARRIVAL : 0
      phase('ascending'); sample()
      return true
    },
    step(dt: number) {
      if (state.phase === 'idle' || state.phase === 'popped' || !Number.isFinite(dt) || dt <= 0) return
      state.age += dt; sample()
    },
    skipTravel() { if (state.phase === 'ascending') { state.age = Math.max(state.age, JOURNEY_ARRIVAL); sample() } },
    reset() {
      state.index = -1; state.age = state.travel = state.rise = state.growth = 0
      phase('idle')
    },
  }
}
