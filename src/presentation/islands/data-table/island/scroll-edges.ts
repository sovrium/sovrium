/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject, UIEvent, SyntheticEvent } from 'react'

/** A pixel of slack: sub-pixel column widths leave `scrollWidth` a fraction over. */
const SLACK = 1

/**
 * Whether the region still hides content past its right edge. Logical, so a
 * right-to-left grid (whose `scrollLeft` runs negative) reads the same.
 */
const overflowsEnd = (region: HTMLElement): boolean =>
  Math.abs(region.scrollLeft) + region.clientWidth < region.scrollWidth - SLACK

/**
 * The scroll region's two edges, kept on the region itself as data attributes.
 *
 * `data-scrolled` marks the START edge once the reader has scrolled sideways, so
 * a pinned column casts its shadow over the columns sliding under it — and only
 * then: at rest nothing is under it. `data-overflow-end` marks the END edge while
 * columns are still clipped past it, which is the one cue a wide grid gives that
 * there is more to the right — the trailing action column included. The end is
 * re-read on resize as well as on scroll: a grid that fits on a wide screen
 * stops fitting when the window narrows, with no scroll event to say so.
 */
export function useScrollEdges(): {
  readonly regionRef: RefObject<HTMLDivElement | null>
  readonly onScroll: (event: UIEvent<HTMLDivElement>) => void
  readonly overflowEnd: boolean
} {
  const regionRef = useRef<HTMLDivElement>(null)
  const [overflowEnd, setOverflowEnd] = useState(false)

  const sync = useCallback((region: HTMLDivElement): void => {
    const end = overflowsEnd(region)
    region.setAttribute('data-scrolled', String(region.scrollLeft !== 0))
    region.setAttribute('data-overflow-end', String(end))
    setOverflowEnd(end)
  }, [])

  useLayoutEffect(() => {
    const region = regionRef.current
    if (!region) return undefined
    sync(region)
    const observer = new ResizeObserver(() => sync(region))
    observer.observe(region)
    const table = region.querySelector('table')
    if (table) observer.observe(table)
    return () => observer.disconnect()
  }, [sync])

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => sync(event.currentTarget),
    [sync]
  )
  return { regionRef, onScroll, overflowEnd }
}

/** Whether an element cuts its own text off — the cell, or the span it truncates in. */
const clips = (element: Element): boolean => element.scrollWidth > element.clientWidth + SLACK

/**
 * Names a clipped cell's whole value on hover.
 *
 * A cell draws one line and ends it with an ellipsis, so a long value is read
 * only as far as its column is wide. The cell says the rest through `title`
 * while — and only while — it is cut off, so a value that fits gets no tooltip
 * repeating it. A `title` the cell already carries is the author's, and stays.
 */
export function nameClippedCell(event: SyntheticEvent<HTMLElement>): void {
  if (!(event.target instanceof Element)) return
  const cell = event.target.closest('td')
  if (!cell || (cell.hasAttribute('title') && !cell.hasAttribute('data-clipped-title'))) return
  const text = (cell.textContent ?? '').trim()
  if (text !== '' && [cell, ...cell.children].some(clips)) {
    cell.setAttribute('title', text)
    cell.setAttribute('data-clipped-title', '')
  } else if (cell.hasAttribute('data-clipped-title')) {
    cell.removeAttribute('title')
    cell.removeAttribute('data-clipped-title')
  }
}
