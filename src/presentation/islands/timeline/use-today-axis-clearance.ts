/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The "Today" badge sits in the axis row, on the rule — so it can land on an
 * axis date and leave a sliver of that label showing beside it ("3" of
 * "Oct 13"). Where the badge's box meets a label's, the label is hidden: the
 * badge already names that point of the axis.
 *
 * The labels are spread across the row by flex layout, not placed by date, so
 * the overlap is measured on the laid-out boxes rather than computed from the
 * instants. A hidden label keeps its box (`visibility`), so the others do not
 * move; the check re-runs whenever the plot is resized.
 */

import { useLayoutEffect, useRef, type RefObject } from 'react'

const overlaps = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** Hide every axis label inside `plot` whose box the today badge covers. */
function clearAxisUnderBadge(plot: HTMLElement): void {
  const badge = plot.querySelector<HTMLElement>('[data-timeline-today] [data-slot="badge"]')
  const ticks = Array.from(plot.querySelectorAll<HTMLElement>('[data-timeline-tick]'))
  ticks.forEach((tick) => {
    tick.style.removeProperty('visibility')
    tick.removeAttribute('aria-hidden')
  })
  if (badge === null) return
  const badgeBox = badge.getBoundingClientRect()
  ticks
    .filter((tick) => overlaps(tick.getBoundingClientRect(), badgeBox))
    .forEach((tick) => {
      tick.style.setProperty('visibility', 'hidden')
      tick.setAttribute('aria-hidden', 'true')
    })
}

/** A ref for the plot; the axis labels under its today badge are kept hidden. */
export function useTodayAxisClearance(): RefObject<HTMLDivElement | null> {
  const plot = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const element = plot.current
    if (element === null) return undefined
    clearAxisUnderBadge(element)
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => clearAxisUnderBadge(element))
    observer.observe(element)
    return () => observer.disconnect()
  })
  return plot
}
