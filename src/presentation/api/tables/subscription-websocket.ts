/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The WebSocket transport of a table subscription: the upgrade, the events it
 * sends, and the per-connection state that re-checks the read grant.
 */

import { upgradeWebSocket } from 'hono/bun'
import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import {
  scopeChangeToReader,
  type RowReadRule,
} from '@/domain/models/app/tables/realtime-row-scope-service'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import { tableChannel } from '@/infrastructure/realtime/record-change-publisher'
import {
  readableChange,
  toWebSocketWireMessage,
  withStringRelationshipLinks,
  type RowStreamColumns,
} from './subscription-payload'
import type { ConnectionHooks } from '@/infrastructure/realtime/connection-counter'
import type { Context } from 'hono'

// ---------------------------------------------------------------------------
// WebSocket transport
// ---------------------------------------------------------------------------

/**
 * Detect a WebSocket upgrade handshake. A browser `WebSocket` client sends
 * `Upgrade: websocket`; a plain `fetch`/SSE caller does not.
 */
export const isWebSocketUpgrade = (c: Context): boolean =>
  (c.req.header('upgrade') ?? '').toLowerCase() === 'websocket'

/** The minimal `send`/`close` surface of a Hono WebSocket context. */
interface SendableWebSocket {
  readonly send: (data: string) => unknown
  readonly close: (code?: number, reason?: string) => void
}

/** Per-connection teardown handle held across the WebSocket lifetime. */
interface WebSocketConnectionState {
  unsubscribe?: () => void
  heartbeat?: ReturnType<typeof setInterval>
}

/**
 * Serialise and send a realtime message over a WebSocket. A send on an
 * already-closed socket is swallowed — `onClose` runs the teardown path.
 */
const sendWebSocketMessage = (ws: SendableWebSocket, msg: Record<string, unknown>): void => {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // Connection already torn down.
  }
}

/**
 * Build the per-connection event callbacks for one upgraded WebSocket.
 *
 * The socket is registered as a channel-manager listener (the SAME fan-out
 * the SSE transport uses) so it receives live `insert`/`update`/`delete`
 * change events. A `subscribed` confirmation is sent on open, a 30s heartbeat
 * ping keeps the connection alive, a client `ping` is answered with a `pong`,
 * and the channel listener + heartbeat timer are torn down on close.
 */
const buildWebSocketEvents = (params: {
  readonly appId: string
  readonly tableName: string
  readonly columns: RowStreamColumns
  readonly fields: readonly string[] | undefined
  readonly reads: RowReadRule | undefined
  readonly links: readonly string[]
  /** Released on `onClose` so the per-user connection counter does not leak. */
  readonly release: () => void
  /** Hands the registry how this socket is closed and re-checked. */
  readonly bind: (hooks: ConnectionHooks) => void
  /** Resolves the grant again and answers whether it still matches. */
  readonly recheck: NonNullable<ConnectionHooks['recheck']>
}) => {
  const { appId, tableName, columns, fields, reads, links, release, bind, recheck } = params
  const state: WebSocketConnectionState = {}

  return {
    onOpen(_event: Event, ws: SendableWebSocket): void {
      sendWebSocketMessage(ws, { type: 'subscribed', table: tableName })

      state.unsubscribe = addChannelListener(tableChannel(appId, tableName), (event) => {
        const scoped = scopeChangeToReader(event, reads)
        if (scoped === undefined) return
        const wire = toWebSocketWireMessage(readableChange(columns, scoped), fields)
        sendWebSocketMessage(ws, withStringRelationshipLinks(wire, links))
      })

      state.heartbeat = setInterval(() => {
        sendWebSocketMessage(ws, { type: 'heartbeat', timestamp: new Date().toISOString() })
      }, REALTIME_TRANSPORT_CONFIG.heartbeatIntervalMs)

      // A grant change or the end of the socket's session — at once from an
      // in-process door, or at the next re-check for one made elsewhere —
      // closes the socket with the code the registry hands over (grant-changed:
      // reconnect; session-ended: sign in again). The listener goes first so
      // nothing more is sent; `onClose` still runs the rest of the teardown.
      bind({
        close: (cause) => {
          if (state.unsubscribe) state.unsubscribe()
          try {
            ws.close(cause.code, cause.reason)
          } catch {
            // Already closing — `onClose` runs the teardown path.
          }
        },
        recheck,
      })
    },
    onMessage(event: { data: unknown }, ws: SendableWebSocket): void {
      // A client-sent `ping` keep-alive is answered with a `pong`.
      const text = typeof event.data === 'string' ? event.data : ''
      if (text.includes('ping')) {
        sendWebSocketMessage(ws, { type: 'pong', timestamp: new Date().toISOString() })
      }
    },
    onClose(): void {
      if (state.unsubscribe) state.unsubscribe()
      if (state.heartbeat) clearInterval(state.heartbeat)
      release()
    },
  }
}

/**
 * Upgrade the request to a WebSocket connection driven by the per-connection
 * event callbacks built by {@link buildWebSocketEvents}.
 */
export const handleWebSocketUpgrade = (params: {
  readonly c: Context
  readonly appId: string
  readonly tableName: string
  readonly columns: RowStreamColumns
  readonly fields: readonly string[] | undefined
  readonly reads: RowReadRule | undefined
  readonly links: readonly string[]
  readonly release: () => void
  readonly bind: (hooks: ConnectionHooks) => void
  readonly recheck: NonNullable<ConnectionHooks['recheck']>
}): Promise<Response> => {
  const { c, ...events } = params
  const middleware = upgradeWebSocket(() => buildWebSocketEvents(events))

  // `upgradeWebSocket` is a Hono middleware: invoke it directly with a no-op
  // `next` so it runs `server.upgrade()` and returns the 101 handshake.
  return Promise.resolve(middleware(c, async () => undefined)).then(
    (res) => res ?? new Response(undefined, { status: 426 })
  )
}
