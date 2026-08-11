/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
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
          onChange()
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
  }, [enabled, table, onChange])

  return enabled ? status : undefined
}
