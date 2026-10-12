export function burstSoundProfile(radius: number, isSphere: boolean) {
  if (isSphere || radius < .3) {
    const size = Math.max(0, Math.min(1, (radius - .1) / .2))
    return { kind: 'tiny' as const, gain: .12 + size * .12, rate: 1.28 - size * .35 }
  }
  if (radius < .5) return { kind: 'small' as const, gain: .42, rate: 1.1 }
  return { kind: 'large' as const, gain: .68, rate: 1 }
}
