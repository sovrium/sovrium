/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a calendar panel that opens under its box sits so that all of it is
 * in the window — the collision handling a positioned popup gets, for a panel
 * laid out `absolute` under the box it belongs to (so it stays inside the
 * dialog it opens in, and inside the field's outside-press boundary).
 *
 * Under the box when it fits there; else above it when it fits there; else on
 * the roomier side, shifted back inside the window. Shifted left when it would
 * run past the window's right edge. Measured before paint, again whenever
 * `remeasure` changes (a month with one more week is taller).
 */

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'

/** The gap between the box and the panel, and the panel and the window's edge, in px. */
const GAP = 4
const EDGE = 8

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(value, high))

/** The panel's top, in the window, for a box at `anchor` and a panel `height` high. */
function topInView(anchor: DOMRect, height: number, windowHeight: number): number {
  const below = anchor.bottom + GAP
  const above = anchor.top - GAP - height
  if (below + height <= windowHeight - EDGE) return below
  if (above >= EDGE) return above
  const roomBelow = windowHeight - anchor.bottom
  const preferred = roomBelow >= anchor.top ? below : above
  return clamp(preferred, EDGE, Math.max(EDGE, windowHeight - EDGE - height))
}

/** The panel's offsets from its positioned box, keeping it in the window — see the module note. */
export function useInViewPlacement(
  panel: RefObject<HTMLElement | null>,
  remeasure?: unknown
): CSSProperties | undefined {
  const [placement, setPlacement] = useState<CSSProperties | undefined>(undefined)
  useLayoutEffect(() => {
    const element = panel.current
    const box = element?.offsetParent
    if (element === null || element === undefined || !(box instanceof HTMLElement)) return
    const anchor = box.getBoundingClientRect()
    const { width, height } = element.getBoundingClientRect()
    const top = topInView(anchor, height, window.innerHeight)
    const left = clamp(anchor.left, EDGE, Math.max(EDGE, window.innerWidth - EDGE - width))
    setPlacement({ top: top - anchor.top, left: left - anchor.left, marginTop: 0 })
  }, [panel, remeasure])
  return placement
}
