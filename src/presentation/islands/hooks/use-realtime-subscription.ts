/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import type { RealtimeConnectionStatus } from '@/domain/models/api/realtime/realtime'

export type RealtimeConnectionState = RealtimeConnectionStatus['status']

export function useRealtimeSubscription(params: {
  readonly enabled: boolean
  readonly table: string
  readonly onChange: () => void
}): RealtimeConnectionState | undefined {
  const { enabled, table, onChange } = params
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
        if (parsed.type === 'change') {
          onChange()
        }
      } catch {
      }
    }

    const handleOpen = () => setStatus('connected')

    const handleError = () => {
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
