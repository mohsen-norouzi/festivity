export type JourneyPhase = 'idle' | 'ascending' | 'popped'
export const JOURNEY_LIFT_DELAY = .6
export const JOURNEY_ARRIVAL = 3.7
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return clamp(t * t * t * (t * (t * 6 - 15) + 10)) }

/** One visible-time clock drives the balloon, camera, DOM page, and immediate arrival pop. */
export function createBalloonJourney(onPhase: (phase: JourneyPhase) => void = () => {}) {
  const state = { phase: 'idle' as JourneyPhase, index: -1, age: 0, travel: 0, rise: 0, growth: 0 }
  let previousAge = 0
  const travelAt = (age: number) => smooth((age - JOURNEY_LIFT_DELAY) / (JOURNEY_ARRIVAL - JOURNEY_LIFT_DELAY))
  const phase = (next: JourneyPhase) => { if (state.phase !== next) { state.phase = next; onPhase(next) } }
  const sample = () => {
    state.travel = travelAt(state.age)
    const progress = clamp(state.age / JOURNEY_ARRIVAL)
    // Ease into lift, but retain upward velocity right through the burst.
    state.rise = progress * progress * (2 - progress)
    state.growth = progress * progress * (3 - 2 * progress)
    if (state.age >= JOURNEY_ARRIVAL) phase('popped')
  }
  return {
    state,
    // Draw the camera at the same interpolated instant as the physical bodies.
    // Sampling the eased curve at that instant also stays smooth above 90 Hz.
    renderTravel(alpha = 1) {
      if (state.phase !== 'ascending') return state.travel
      return travelAt(previousAge + (state.age - previousAge) * clamp(alpha))
    },
    start(index: number, reducedMotion = false) {
      if (state.phase !== 'idle' || !Number.isInteger(index) || index < 0) return false
      state.index = index; state.age = reducedMotion ? JOURNEY_ARRIVAL : 0
      previousAge = state.age
      phase('ascending'); sample()
      return true
    },
    step(dt: number) {
      if (state.phase === 'idle' || state.phase === 'popped' || !Number.isFinite(dt) || dt <= 0) return
      previousAge = state.age
      state.age += dt; sample()
    },
    skipTravel() { if (state.phase === 'ascending') { state.age = Math.max(state.age, JOURNEY_ARRIVAL); previousAge = state.age; sample() } },
    reset() {
      previousAge = 0
      state.index = -1; state.age = state.travel = state.rise = state.growth = 0
      phase('idle')
    },
  }
}
