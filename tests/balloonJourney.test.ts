import { describe, expect, test } from 'bun:test'
import { createBalloonJourney, JOURNEY_ARRIVAL } from '../src/balloonJourney'

const advance = (journey: ReturnType<typeof createBalloonJourney>, duration: number, fps = 90) => {
  const steps = Math.ceil(duration * fps)
  for (let i = 0; i < steps; i++) journey.step(duration / steps)
}

describe('balloon-led page ascent', () => {
  test('the camera follows one screen and arrival triggers exactly one pop without a holding phase', () => {
    const phases: string[] = []
    const journey = createBalloonJourney(phase => phases.push(phase))
    journey.start(4)
    advance(journey, .4)
    expect(journey.state.growth).toBeGreaterThan(0)
    expect(journey.state.rise).toBeGreaterThan(0)
    expect(journey.state.travel).toBe(0)
    advance(journey, JOURNEY_ARRIVAL - .4 + .01)
    expect(journey.state.travel).toBe(1)
    expect(journey.state.rise).toBe(1)
    expect(journey.state.phase).toBe('popped')
    advance(journey + .01)
    expect(journey.state.phase).toBe('popped')
    advance(journey, 20)
    expect(phases).toEqual(['ascending', 'popped'])
  })

  test('additional clicks cannot interrupt the selected balloon or restart its flight', () => {
    const journey = createBalloonJourney()
    journey.start(2); advance(journey, 1)
    expect(journey.start(5)).toBe(false)
    expect(journey.state.index).toBe(2)
    expect(journey.state.age).toBeCloseTo(1)
    advance(journey, 5)
    expect(journey.start(1)).toBe(false)
  })

  test('travel is monotonic and frame-rate independent', () => {
    const slow = createBalloonJourney(), fast = createBalloonJourney()
    slow.start(0); fast.start(0)
    advance(slow, 2, 30); advance(fast, 2, 144)
    expect(slow.state.travel).toBeCloseTo(fast.state.travel, 9)
    expect(slow.state.growth).toBeCloseTo(fast.state.growth, 9)
    let previous = fast.state.travel
    for (let i = 0; i < 400; i++) {
      fast.step(1 / 90)
      expect(fast.state.travel).toBeGreaterThanOrEqual(previous)
      expect(fast.state.travel).toBeLessThanOrEqual(1)
      previous = fast.state.travel
    }
  })

  test('returning during ascent cancels the pop and permits a fresh choice', () => {
    const phases: string[] = []
    const journey = createBalloonJourney(phase => phases.push(phase))
    journey.start(26); advance(journey, 2)
    journey.reset(); advance(journey, 5)
    expect(journey.state.phase).toBe('idle')
    expect(journey.state.travel).toBe(0)
    expect(journey.state.index).toBe(-1)
    expect(phases).not.toContain('popped')
    expect(journey.start(3)).toBe(true)
  })

  test('upward speed stays positive all the way to the pop', () => {
    const journey = createBalloonJourney()
    journey.start(0)
    advance(journey, JOURNEY_ARRIVAL - .02)
    const before = journey.state.rise
    journey.step(.01)
    expect((journey.state.rise - before) / .01).toBeGreaterThan(.25)
    expect(journey.state.phase).toBe('ascending')
    journey.step(.011)
    expect(journey.state.phase).toBe('popped')
  })

  test('reduced motion skips both the climb and any arrival delay', () => {
    const journey = createBalloonJourney()
    journey.start(1, true)
    expect(journey.state.travel).toBe(1)
    expect(journey.state.phase).toBe('popped')
  })

  test('invalid time and selection cannot corrupt the transition', () => {
    const journey = createBalloonJourney()
    expect(journey.start(-1)).toBe(false)
    journey.start(0)
    journey.step(NaN); journey.step(-1); journey.step(Infinity)
    expect(journey.state.age).toBe(0)
    journey.skipTravel()
    expect(journey.state.phase).toBe('popped')
    expect(journey.state.travel).toBe(1)
  })
})
