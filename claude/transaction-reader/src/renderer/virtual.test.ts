import { describe, expect, it } from 'vitest'
import { computeVisibleRange } from './virtual'

describe('computeVisibleRange', () => {
  it('returns an empty range when there are no rows', () => {
    expect(computeVisibleRange(0, 600, 30, 0, 8)).toEqual({ first: 0, last: 0 })
  })

  it('returns an empty range when rowHeight is non-positive', () => {
    expect(computeVisibleRange(0, 600, 0, 100, 8)).toEqual({ first: 0, last: 0 })
  })

  it('starts at 0 when scrolled to the top', () => {
    // 600px viewport / 30px rows = 20 visible + 2*8 overscan = 36, clamped to total.
    expect(computeVisibleRange(0, 600, 30, 1000, 8)).toEqual({ first: 0, last: 36 })
  })

  it('windows around the scroll position when scrolled', () => {
    // scrollTop 3000 / 30 = row 100; minus 8 overscan = 92.
    const r = computeVisibleRange(3000, 600, 30, 1000, 8)
    expect(r.first).toBe(92)
    expect(r.last).toBe(92 + 36)
  })

  it('clamps the last index to the total row count', () => {
    const r = computeVisibleRange(29_700, 600, 30, 1000, 8)
    expect(r.last).toBe(1000)
    expect(r.first).toBeLessThan(1000)
  })

  it('never returns a negative first index', () => {
    expect(computeVisibleRange(60, 600, 30, 1000, 8).first).toBe(0)
  })

  it('renders only a small window even for a huge list', () => {
    const r = computeVisibleRange(15_000, 600, 30, 100_000, 8)
    expect(r.last - r.first).toBeLessThanOrEqual(36)
  })
})
