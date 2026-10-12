import { describe, expect, test } from 'bun:test'
import { createEntrance, shuffledIndices } from '../src/entrance'

describe('progressive entrance', () => {
  test('only launches prepared pieces, once, without waiting for the others', () => {
    const entrance = createEntrance(3, () => 0)
    const launched: number[] = []
    entrance.step(1, i => launched.push(i))
    expect(launched).toEqual([])
    entrance.ready(2); entrance.ready(2)
    entrance.step(.016, i => launched.push(i))
    expect(launched).toEqual([2])
    expect(entrance.prepared).toBe(1)
    expect(entrance.hasEntered(0)).toBe(false)
    expect(entrance.complete).toBe(false)
    entrance.ready(0); entrance.ready(1)
    entrance.step(.06, i => launched.push(i))
    entrance.step(.06, i => launched.push(i))
    expect(launched).toEqual([2, 0, 1])
    expect(entrance.complete).toBe(true)
  })

  test('a stalled frame or background-tab return cannot reveal the whole queue', () => {
    const entrance = createEntrance(20, () => .5)
    for (let i = 0; i < 20; i++) entrance.ready(i)
    const launched: number[] = []
    entrance.step(60, i => launched.push(i))
    expect(launched).toHaveLength(1)
    entrance.step(60, i => launched.push(i))
    expect(launched).toHaveLength(1)
    entrance.step(.016, i => launched.push(i))
    expect(launched).toHaveLength(2)
  })

  test('reset during preparation replays ready pieces and accepts later arrivals', () => {
    const entrance = createEntrance(3, () => 0)
    entrance.ready(1); entrance.ready(0)
    entrance.step(.016, () => {})
    entrance.replay()
    expect(entrance.entered).toBe(0)
    entrance.ready(2)
    const launched: number[] = []
    for (let i = 0; i < 10; i++) entrance.step(.06, i => launched.push(i))
    expect(launched).toEqual([1, 0, 2])
    expect(entrance.complete).toBe(true)
  })

  test('randomized preparation order preserves every index exactly once', () => {
    const indices = shuffledIndices(31, () => .24)
    expect(indices).not.toEqual(Array.from({ length: 31 }, (_, i) => i))
    expect([...indices].sort((a, b) => a - b)).toEqual(Array.from({ length: 31 }, (_, i) => i))
  })
})
