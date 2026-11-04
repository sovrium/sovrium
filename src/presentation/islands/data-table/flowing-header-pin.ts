/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/** Where the column heads are and where they may go, all in viewport pixels. */
export interface HeaderPinGeometry {
  /** The top edge of what the reader can see: the page scroller's own top, below what sticks over it. */
  readonly line: number
  /** Where the header sits when nothing moves it. */
  readonly naturalTop: number
  readonly headHeight: number
  /** The bottom of the table: the header never leaves the rows it names. */
  readonly tableBottom: number
}

/**
 * How far down the header has to travel to stay on screen: nothing while its
 * table still starts below the visible top, the distance scrolled past once it
 * does, and never past the table's last row, so the labels leave with the
 * grid once the grid itself has gone by.
 */
export const headerPinOffset = (geometry: HeaderPinGeometry): number => {
  const room = geometry.tableBottom - geometry.naturalTop - geometry.headHeight
  return Math.max(0, Math.min(geometry.line - geometry.naturalTop, room))
}

/** A box that scrolls vertically now: it may, and its content overflows it. */
const scrolls = (element: HTMLElement): boolean => {
  const { overflowY } = getComputedStyle(element)
  return (
    (overflowY === 'auto' || overflowY === 'scroll') &&
    element.scrollHeight > element.clientHeight + 1
  )
}

/**
 * The box the page scrolls in, above the grid's own sideways region; `undefined`
 * when it is the document. The grid's region is skipped because it is a scroll
 * container on both axes without ever moving vertically, which is precisely why
 * `position: sticky` cannot pin a flowing grid's header to the page. A box that
 * may scroll but has nothing to scroll is skipped too: it is not where the page
 * moves. Resolved at every placement, never once at mount, because the shell's
 * styles and the rows that make the page overflow may both arrive after it.
 */
const pageScroller = (head: HTMLElement): HTMLElement | undefined => {
  const region = head.closest('[data-slot="table-container"]') ?? head
  const climb = (element: HTMLElement | null): HTMLElement | undefined =>
    element === null || element === document.body
      ? undefined
      : scrolls(element)
        ? element
        : climb(element.parentElement)
  return climb(region.parentElement)
}

const visibleTop = (scroller: HTMLElement | undefined): number =>
  scroller === undefined ? 0 : scroller.getBoundingClientRect().top + scroller.clientTop

/** The positions that keep a box over the page while it scrolls. */
const STUCK_POSITIONS: ReadonlySet<string> = new Set(['sticky', 'fixed'])

/**
 * What is drawn OVER the grid at one point: the boxes the browser stacks
 * above the first one that holds the grid or sits inside it. A box painted
 * beneath the grid, such as a dialog's backdrop, never covers it.
 */
const stackedOver = (x: number, y: number, region: Element): readonly Element[] => {
  const stack = document.elementsFromPoint(x, y)
  const grid = stack.findIndex((hit) => hit.contains(region) || region.contains(hit))
  return grid === -1 ? stack : stack.slice(0, grid)
}

/**
 * A bar stuck over the page: sticky or fixed, and shorter than half the
 * screen, so an overlay drawn over all of it (a dialog's backdrop) is no bar.
 */
const isStuckBar = (hit: Element): boolean =>
  STUCK_POSITIONS.has(getComputedStyle(hit).position) &&
  hit.getBoundingClientRect().height < innerHeight / 2

/**
 * The line moved below whatever sticks over the grid across its width: an app
 * shell's bar, a fixed banner. Probed at the grid's two edges and its middle,
 * so a sticky sidebar beside the grid does not count. Repeated from the new
 * line, a few times at most, for a bar stacked under another.
 */
const lineBelowStuckBoxes = (line: number, region: Element, depth = 0): number => {
  const { left, right } = region.getBoundingClientRect()
  const xs = [left + 1, (left + right) / 2, right - 1].filter((x) => x >= 0 && x < innerWidth)
  const bottom = [...new Set(xs.flatMap((x) => stackedOver(x, line, region)))]
    .filter(isStuckBar)
    .reduce((lowest, hit) => Math.max(lowest, hit.getBoundingClientRect().bottom), line)
  return bottom > line && depth < 3 ? lineBelowStuckBoxes(bottom, region, depth + 1) : line
}

/**
 * Keep a flowing grid's column heads on screen while the page scrolls its rows.
 *
 * A grid at its natural height owns no vertical scroll, and the sideways
 * region it does own is a scroll container, so a sticky header pins to a box
 * that never moves. The header is therefore carried by a transform instead,
 * measured against the scroller the page actually moves in, below anything
 * stuck over that scroller's top, and re-measured
 * whenever anything scrolls or the table changes size. Inert when `enabled`
 * is false: a `layout: fill` grid pins its header with CSS.
 */
export function useFlowingHeaderPin(enabled: boolean): RefObject<HTMLTableSectionElement | null> {
  const headRef = useRef<HTMLTableSectionElement>(null)

  useEffect(() => {
    const head = headRef.current
    const table = head?.closest('table')
    if (!enabled || !head || !table) return undefined
    const region = head.closest('[data-slot="table-container"]') ?? table
    const state = { offset: 0, frame: 0 }
    const place = (): void => {
      state.frame = 0
      const box = head.getBoundingClientRect()
      const offset = headerPinOffset({
        line: lineBelowStuckBoxes(visibleTop(pageScroller(head)), region),
        naturalTop: box.top - state.offset,
        headHeight: box.height,
        tableBottom: table.getBoundingClientRect().bottom,
      })
      if (offset === state.offset) return
      state.offset = offset
      head.style.transform = offset > 0 ? `translateY(${offset}px)` : ''
    }
    const schedule = (): void => {
      if (state.frame === 0) state.frame = requestAnimationFrame(place)
    }
    // Every scroll, of the document or of any box, reaches the document in its
    // capture phase, so the pin follows whichever box the page moves in. It is
    // placed in the scroll's own frame: scroll events already arrive once per
    // frame, and a further frame of delay is a frame the labels are gone.
    document.addEventListener('scroll', place, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    observer.observe(table)
    place()
    return () => {
      document.removeEventListener('scroll', place, { capture: true })
      window.removeEventListener('resize', schedule)
      observer.disconnect()
      cancelAnimationFrame(state.frame)
      head.style.transform = ''
    }
  }, [enabled])

  return headRef
}
