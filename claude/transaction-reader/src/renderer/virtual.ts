export interface VisibleRange {
  /** First row index to render (inclusive). */
  first: number
  /** One past the last row index to render (exclusive). */
  last: number
}

/**
 * Compute which row indices a fixed-row-height virtualized list should render.
 *
 * `overscan` rows are rendered beyond each edge of the viewport so scrolling
 * doesn't reveal blank space before React catches up. The sticky header's
 * height is not subtracted from `scrollTop`; overscan absorbs that offset.
 */
export function computeVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  total: number,
  overscan: number,
): VisibleRange {
  if (total <= 0 || rowHeight <= 0) return { first: 0, last: 0 }
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2
  const last = Math.min(total, first + visibleCount)
  return { first, last }
}
