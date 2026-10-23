/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

/** How often a `poll` thread re-reads itself. */
const POLL_INTERVAL_MS = 30_000

/** How long a dropped `realtime` connection first waits before it opens again; each retry waits longer. */
const RECONNECT_DELAY_MS = 3000

/** Reconnections in a row before the thread stops following; an open connection resets the count. */
const MAX_RECONNECTS = 5

/** The app connection following one record's comment thread. */
const connectionUrl = (tableName: string, recordId: string): string => {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const query = new URLSearchParams({
    table: tableName,
    record: recordId,
    page: window.location.pathname,
  })
  return `${scheme}://${window.location.host}/api/realtime/connection?${query.toString()}`
}

/** Whether a frame names a change to the thread. */
const isCommentChange = (data: unknown): boolean => {
  if (typeof data !== 'string') return false
  try {
    return (JSON.parse(data) as { readonly type?: unknown }).type === 'comment'
  } catch {
    return false
  }
}

/**
 * Keep an open thread following its record (`refreshMode`): `poll` re-reads it
 * every 30 seconds, `realtime` re-reads it on each comment change the app
 * connection announces. Either way the thread RE-READS its list, so it draws
 * only what the list answers this reader.
 */
export function useThreadFollow(input: {
  readonly tableName: string
  readonly recordId: string
  readonly refreshMode: 'poll' | 'realtime' | undefined
}): void {
  const { tableName, recordId, refreshMode } = input
  const queryClient = useQueryClient()
  useEffect(() => {
    if (refreshMode === undefined) return undefined
    const reread = (): void => {
      void queryClient.invalidateQueries({ queryKey: ['comments', tableName, recordId] })
    }
    if (refreshMode === 'poll') {
      const timer = setInterval(reread, POLL_INTERVAL_MS)
      return () => clearInterval(timer)
    }
    const state: {
      socket?: WebSocket
      retry?: ReturnType<typeof setTimeout>
      ended: boolean
      attempts: number
    } = { ended: false, attempts: 0 }
    const open = (): void => {
      const socket = new WebSocket(connectionUrl(tableName, recordId))
      socket.onopen = () => {
        state.attempts = 0
      }
      socket.onmessage = (event) => {
        if (isCommentChange(event.data)) reread()
      }
      socket.onclose = (event) => {
        // 1008 is a refusal (the session ended): opening again would be refused too. A
        // handshake refused outright (a 401 or 429) closes as 1006 instead, so the
        // attempts are counted and spaced, never retried forever.
        if (state.ended || event.code === 1008 || state.attempts >= MAX_RECONNECTS) return
        state.attempts += 1
        state.retry = setTimeout(open, RECONNECT_DELAY_MS * state.attempts)
      }
      state.socket = socket
    }
    open()
    return () => {
      state.ended = true
      if (state.retry !== undefined) clearTimeout(state.retry)
      state.socket?.close()
    }
  }, [queryClient, tableName, recordId, refreshMode])
}
