/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef, useState } from 'react'
import type { RealtimeConnectionStatus } from '@/domain/models/api/realtime/realtime'

/** Logical connectivity state of the realtime transport. */
export type RealtimeConnectionState = RealtimeConnectionStatus['status']

/**
 * Live realtime subscription for a data-bound island (Wave-1 consumer side).
 *
 * When a data source declares `refreshMode: 'realtime'`, this hook opens an
 * `EventSource` against `GET /api/tables/:table/subscribe` and invokes
 * `onChange` whenever the server pushes a `change` event for the bound table.
 *
 * The island responds to `onChange` by invalidating its TanStack Query, which
 * triggers a re-fetch. Because the re-fetch goes through the records API with
 * the same `dataSource.filter`/`sort` query params, server-side filtering
 * and sorting are applied
 * automatically — the client never has to re-implement the predicate.
 *
 * The browser `EventSource` auto-reconnects when the server closes the stream
 * after its bounded lifetime, so a long-lived page keeps receiving events.
 *
 * The hook also surfaces the transport connection state:
 * `EventSource.onopen` resolves it to `'connected'`, while `onerror` resolves
 * it to `'reconnecting'` (the browser will retry) or `'disconnected'` (the
 * connection is permanently closed). A page section can render a connection
 * indicator off this value.
 */
export function useRealtimeSubscription(params: {
  readonly enabled: boolean
  readonly table: string
  readonly onChange: () => void
}): RealtimeConnectionState | undefined {
  const { enabled, table, onChange } = params
  // `reconnecting` is the initial state while the EventSource opens; it
  // resolves to `connected` on `onopen` or `disconnected` on a fatal error.
  const [status, setStatus] = useState<RealtimeConnectionState>('reconnecting')

  // `onChange` is read through a ref, and the connection effect below does NOT
  // depend on it. That is load-bearing, not tidiness.
  //
  // The caller is the grid's `handleRefresh`, a `useCallback` keyed on the
  // records query key — and `buildQueryKey` returns a fresh array literal on
  // every render, so `handleRefresh` has a new identity on every render too.
  // With `onChange` in the dependency array, this effect re-ran on EVERY
  // render: it closed the `EventSource` and opened a replacement, which
  // unregistered the server-side channel listener and registered a new one.
  // A change published in any of those gaps reached no listener at all, and
  // `channel-manager` has no buffer and no replay, so it was dropped silently
  // and permanently. That is why a write issued moments after the connection
  // announced itself as `connected` so often never arrived: the connection it
  // announced had already been replaced.
  //
  // A ref keeps the handler current while making the socket's lifetime depend
  // on the only two things that should ever change it — whether realtime is on,
  // and which table it is bound to.
  const onChangeRef = useRef(onChange)
  // eslint-disable-next-line functional/immutable-data -- ref write: keeps the latest handler reachable without re-opening the socket
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return undefined
    }

    setStatus('reconnecting')
    const source = new EventSource(`/api/tables/${encodeURIComponent(table)}/subscribe`)

    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string }
        // Only a `change` event warrants a re-fetch; `subscribed`/`heartbeat`
        // are connection-keepalive noise.
        if (parsed.type === 'change') {
          onChangeRef.current()
        }
      } catch {
        // Malformed frame — ignore; the next valid event will refresh.
      }
    }

    const handleOpen = () => setStatus('connected')

    const handleError = () => {
      // `readyState === CLOSED` means the browser gave up reconnecting; any
      // other state means a retry is in flight.
      setStatus(source.readyState === EventSource.CLOSED ? 'disconnected' : 'reconnecting')
    }

    source.addEventListener('message', handleMessage)
    source.addEventListener('open', handleOpen)
    source.addEventListener('error', handleError)

    return () => {
      source.removeEventListener('message', handleMessage)
      source.removeEventListener('open', handleOpen)
      source.removeEventListener('error', handleError)
      source.close()
    }
    // `onChange` is deliberately absent — see the ref above. Including it
    // re-opened the socket on every render.
  }, [enabled, table])

  return enabled ? status : undefined
}
