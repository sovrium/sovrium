/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect } from 'react'
import type { RefObject } from 'react'

/** The parent record a conversation's turns are the children of. */
export interface MarkReadTarget {
  readonly table: string
  readonly recordId: string
}

/** The least time between two marks of one parent, in milliseconds. */
const MARK_READ_INTERVAL_MS = 5000

/**
 * Mark a conversation's parent read as its turns are drawn: once the frame is
 * on screen, again at most once every five seconds while new turns are drawn
 * into it, and once more when the page is left. Each mark moves the reader's
 * position to the moment the server receives it.
 */
export function useMarkRead(
  target: MarkReadTarget | undefined,
  anchor: RefObject<HTMLElement | null>
): void {
  const table = target?.table
  const recordId = target?.recordId
  useEffect(() => {
    const frame = anchor.current?.closest<HTMLElement>('[data-slot="message-scroller"]')
    if (table === undefined || recordId === undefined || !frame) return undefined
    const url = `/api/tables/${encodeURIComponent(table)}/records/${encodeURIComponent(recordId)}/read`
    const state: { last: number; timer: number | undefined } = { last: 0, timer: undefined }
    const send = (keepalive: boolean): void => {
      state.last = Date.now()
      void fetch(url, { method: 'POST', credentials: 'same-origin', keepalive }).catch(
        () => undefined
      )
    }
    const schedule = (): void => {
      if (state.timer !== undefined) return
      const wait = Math.max(state.last + MARK_READ_INTERVAL_MS - Date.now(), 0)
      state.timer = window.setTimeout(() => {
        state.timer = undefined
        send(false)
      }, wait)
    }
    const opened = window.requestAnimationFrame(() => send(false))
    const drawn = new MutationObserver(schedule)
    drawn.observe(frame, { childList: true })
    const onLeave = (): void => send(true)
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.cancelAnimationFrame(opened)
      if (state.timer !== undefined) window.clearTimeout(state.timer)
      drawn.disconnect()
      window.removeEventListener('pagehide', onLeave)
    }
  }, [table, recordId, anchor])
}
