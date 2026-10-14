/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'

interface MessageScrollerIslandProps {
  readonly position?: 'start' | 'end' | 'last-anchor'
  readonly autoScroll?: boolean
  readonly anchorPeek?: number
}

/** How close to the end, in pixels, still counts as "at the end" for following new turns. */
const AT_END_SLACK = 24

/** Where the frame's scroll opens, in pixels from the top. */
function openingScrollTop(frame: HTMLElement, position: string, anchorPeek: number): number {
  if (position === 'start') return 0
  const turns = frame.querySelectorAll<HTMLElement>(':scope > [data-slot="message"]')
  const last = turns.item(turns.length - 1)
  if (position === 'last-anchor' && last !== null) {
    return Math.max(last.offsetTop - frame.offsetTop - anchorPeek, 0)
  }
  return frame.scrollHeight
}

/**
 * The `message-scroller` behaviour: an ENHANCEMENT island that renders only an
 * inert anchor inside the server-drawn frame. It opens the frame where the
 * config says — at the latest turn by default — and, with `autoScroll`, keeps
 * the reader at the end as turns are added, unless they had scrolled up.
 */
export default function MessageScrollerIsland({
  position = 'end',
  autoScroll = false,
  anchorPeek = 64,
}: MessageScrollerIslandProps): ReactElement {
  const anchor = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const frame = anchor.current?.closest<HTMLElement>('[data-slot="message-scroller"]')
    if (!frame) return undefined
    frame.scrollTo({ top: openingScrollTop(frame, position, anchorPeek) })
    if (!autoScroll) return undefined
    const atEnd = { current: true }
    const onScroll = (): void => {
      atEnd.current = frame.scrollHeight - frame.clientHeight - frame.scrollTop < AT_END_SLACK
    }
    const follow = new MutationObserver(() => {
      if (atEnd.current) frame.scrollTo({ top: frame.scrollHeight })
    })
    frame.addEventListener('scroll', onScroll, { passive: true })
    follow.observe(frame, { childList: true })
    return () => {
      frame.removeEventListener('scroll', onScroll)
      follow.disconnect()
    }
  }, [position, autoScroll, anchorPeek])
  return (
    <span
      ref={anchor}
      hidden
    />
  )
}
