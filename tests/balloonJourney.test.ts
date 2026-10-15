import { describe, expect, test } from 'bun:test'
import { createBalloonJourney, JOURNEY_ARRIVAL, JOURNEY_RETURN } from '../src/balloonJourney'

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


describe('interpolated ascent camera', () => {
  for (const fps of [30, 60, 75, 120, 144]) {
    test(`no alternating camera jumps at ${fps} fps with 90 Hz physics`, () => {
      const journey = createBalloonJourney(), step = 1 / 90, frame = 1 / fps
      journey.start(0)
      let accumulator = 0, previous = 0, previousSpeed = 0, maximumSpeedJump = 0
      for (let time = 0; time < 3.5; time += frame) {
        accumulator += frame
        while (accumulator >= step) { journey.step(step); accumulator -= step }
        const travel = journey.renderTravel(accumulator / step)
        const speed = (travel - previous) / frame
        if (time > 1 && time < 3.4) maximumSpeedJump = Math.max(maximumSpeedJump, Math.abs(speed - previousSpeed))
        expect(travel).toBeGreaterThanOrEqual(previous)
        expect(travel).toBeLessThanOrEqual(journey.state.travel + 1e-12)
        previous = travel; previousSpeed = speed
      }
      // Without interpolation, 60 Hz alternates one/two physics ticks and 144 Hz
      // repeats entire camera poses. Both produce speed jumps above .3 per second.
      expect(maximumSpeedJump).toBeLessThan(.025)
    })
  }

  test('arrival and reset leave no delayed camera catch-up', () => {
    const journey = createBalloonJourney()
    journey.start(0); advance(journey, 4)
    expect(journey.renderTravel(0)).toBe(1)
    journey.reset()
    expect(journey.renderTravel(.7)).toBe(0)
    journey.start(1, true)
    expect(journey.renderTravel(0)).toBe(1)
  })
})


describe('return to the balloons', () => {
  test('descends once, does not pop again, and allows another flight', () => {
    const phases: string[] = []
    const journey = createBalloonJourney(phase => phases.push(phase))
    expect(journey.returnHome()).toBe(false)
    journey.start(3)
    expect(journey.returnHome()).toBe(false)
    advance(journey, 4)
    expect(journey.returnHome()).toBe(true)
    expect(journey.renderTravel(0)).toBe(1)
    expect(journey.returnHome()).toBe(false)
    expect(journey.start(2)).toBe(false)
    advance(journey, JOURNEY_RETURN / 2)
    expect(journey.state.travel).toBeCloseTo(.5, 8)
    advance(journey, JOURNEY_RETURN / 2 + .01)
    expect(journey.state.phase).toBe('idle')
    expect(journey.renderTravel(0)).toBe(0)
    expect(phases).toEqual(['ascending', 'popped', 'returning', 'idle'])
    expect(journey.start(2)).toBe(true)
    advance(journey, 4)
    expect(phases.filter(phase => phase === 'popped')).toHaveLength(2)
  })

  for (const fps of [30, 60, 75, 120, 144]) {
    test(`descent stays smooth and monotonic at ${fps} fps`, () => {
      const journey = createBalloonJourney(), step = 1 / 90, frame = 1 / fps
      journey.start(0, true); journey.returnHome()
      let accumulator = 0, previous = 1, previousSpeed = 0, maximumSpeedJump = 0
      for (let time = 0; time < 2; time += frame) {
        accumulator += frame
        while (accumulator >= step) { journey.step(step); accumulator -= step }
        const travel = journey.renderTravel(accumulator / step)
        const speed = (travel - previous) / frame
        maximumSpeedJump = Math.max(maximumSpeedJump, Math.abs(speed - previousSpeed))
        expect(travel).toBeLessThanOrEqual(previous)
        expect(travel).toBeGreaterThanOrEqual(0)
        previous = travel; previousSpeed = speed
      }
      expect(maximumSpeedJump).toBeLessThan(.09)
      expect(journey.state.phase).toBe('idle')
    })
  }

  test('reduced motion returns immediately, including when enabled mid-descent', () => {
    const journey = createBalloonJourney()
    journey.start(0, true); journey.returnHome(true)
    expect(journey.state.phase).toBe('idle')
    expect(journey.renderTravel(.3)).toBe(0)
    journey.start(1, true); journey.returnHome(); advance(journey, .4)
    journey.skipTravel()
    expect(journey.state.phase).toBe('idle')
    expect(journey.renderTravel(.7)).toBe(0)
  })

  test('hidden-tab time and repeated requests cannot skip or restart the return', () => {
    const journey = createBalloonJourney()
    journey.start(0, true); journey.returnHome(); advance(journey, .5)
    const travel = journey.renderTravel(.6)
    journey.step(NaN); journey.step(-1); journey.step(0)
    expect(journey.returnHome()).toBe(false)
    expect(journey.renderTravel(.6)).toBe(travel)
    journey.reset(); advance(journey, 5)
    expect(journey.state.phase).toBe('idle')
    expect(journey.renderTravel(0)).toBe(0)
  })
})
