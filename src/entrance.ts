/** Readiness drives the entrance: never expose an unprepared ornament or drain
 * a backlog in one frame after a slow shader compile / backgrounded tab. */
export function createEntrance(count: number, random: () => number = Math.random) {
  const prepared = new Set<number>()
  const entered = new Set<number>()
  const pending: number[] = []
  let delay = 0
  return {
    ready(index: number) {
      if (prepared.has(index)) return
      prepared.add(index)
      pending.push(index)
    },
    step(dt: number, launch: (index: number) => void) {
      delay = Math.max(0, delay - Math.min(dt, .06))
      if (delay > 0 || pending.length === 0) return
      const index = pending.shift()!
      entered.add(index)
      launch(index)
      delay = .045 + random() * .055
    },
    replay() {
      entered.clear()
      pending.length = 0
      pending.push(...prepared)
      delay = 0
    },
    hasEntered: (index: number) => entered.has(index),
    get prepared() { return prepared.size },
    get entered() { return entered.size },
    get complete() { return entered.size === count },
  }
}

export function shuffledIndices(count: number, random: () => number = Math.random) {
  const indices = Array.from({ length: count }, (_, index) => index)
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices
}
