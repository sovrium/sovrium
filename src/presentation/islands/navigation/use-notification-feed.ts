/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react'

/** One notification as the bell draws it — the fields `GET /api/notifications` answers. */
export interface BellNotification {
  readonly id: string
  readonly title: string
  readonly read: boolean
  readonly source: { readonly table: string; readonly recordId: string } | null
}

/** Her notifications and unread count, as the store last answered them. */
interface Feed {
  readonly notifications: readonly BellNotification[]
  readonly unreadCount: number
}

/** How long a dropped connection first waits before it opens again; each retry waits longer. */
const RECONNECT_DELAY_MS = 3000

/** Reconnections in a row before the bell stops following; an open connection resets the count. */
const MAX_RECONNECTS = 5

/** Read her notifications; a failed read keeps what the bell last drew. */
async function readFeed(limit: number): Promise<Feed | undefined> {
  try {
    const response = await fetch('/api/notifications', { credentials: 'include' })
    if (!response.ok) return undefined
    const body = (await response.json()) as Feed
    return { notifications: body.notifications.slice(0, limit), unreadCount: body.unreadCount }
  } catch {
    return undefined
  }
}

/** Whether a frame says her notifications changed. */
const isNotificationsChange = (data: unknown): boolean => {
  if (typeof data !== 'string') return false
  try {
    return (JSON.parse(data) as { readonly type?: unknown }).type === 'notifications-changed'
  } catch {
    return false
  }
}

/** Re-read on every `notifications-changed` frame of her app connection, reconnecting a few times. */
function useFollow(reread: () => void): void {
  useEffect(() => {
    const state: {
      socket?: WebSocket
      retry?: ReturnType<typeof setTimeout>
      ended: boolean
      attempts: number
    } = { ended: false, attempts: 0 }
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const open = (): void => {
      const socket = new WebSocket(`${scheme}://${window.location.host}/api/realtime/connection`)
      socket.onopen = () => {
        state.attempts = 0
      }
      socket.onmessage = (event) => {
        if (isNotificationsChange(event.data)) reread()
      }
      socket.onclose = (event) => {
        // 1008 is a refusal (the session ended): opening again would be refused too.
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
  }, [reread])
}

/**
 * The signed-in reader's notifications, followed live: read once on mount,
 * and again on each change her app connection announces. The bell RE-READS
 * rather than trusting a pushed payload, so what it draws is always what the
 * store answers her. Marking one read, or all, re-reads too.
 */
export function useNotificationFeed(limit: number) {
  const [feed, setFeed] = useState<Feed>({ notifications: [], unreadCount: 0 })
  const reread = useCallback(() => {
    void readFeed(limit).then((next) => {
      if (next !== undefined) setFeed(next)
    })
  }, [limit])
  useEffect(reread, [reread])
  useFollow(reread)

  const markRead = useCallback(
    (id: string): Promise<unknown> =>
      fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => undefined),
    []
  )
  const markAllRead = useCallback(() => {
    void fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' })
      .catch(() => undefined)
      .then(reread)
  }, [reread])

  return { ...feed, markRead, markAllRead }
}
