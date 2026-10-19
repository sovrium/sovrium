/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** Sub-pixel rounding slack, so a board that exactly fits never reads as clipped. */
const SLACK = 1

/** Whether columns are still clipped past the board's right edge. */
const clippedAtEnd = (board: HTMLElement): boolean =>
  Math.abs(board.scrollLeft) + board.clientWidth < board.scrollWidth - SLACK

/**
 * Whether a board's columns run past its right edge, followed live — on scroll,
 * and whenever the board or its row of columns is resized. Drives the end-edge
 * shadow, so a board that scrolls sideways shows it and one that fits does not.
 */
export function useBoardScrollEdge(): {
  readonly boardRef: RefObject<HTMLDivElement | null>
  readonly onScroll: () => void
  readonly clipped: boolean
} {
  const boardRef = useRef<HTMLDivElement>(null)
  const [clipped, setClipped] = useState(false)
  const sync = useCallback((): void => {
    const board = boardRef.current
    if (board) setClipped(clippedAtEnd(board))
  }, [])
  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return undefined
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(board)
    Array.from(board.children).forEach((column) => observer.observe(column))
    return () => observer.disconnect()
  }, [sync])
  return { boardRef, onScroll: sync, clipped }
}
