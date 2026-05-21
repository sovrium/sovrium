/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Stream } from 'effect'
import { upgradeWebSocket } from 'hono/bun'
import {
  evaluateFieldPermissions,
  hasReadPermissionForRoles,
} from '@/application/use-cases/tables/permissions/permissions'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import { registerConnection } from '@/infrastructure/realtime/connection-counter'
import { tableChannel } from '@/infrastructure/realtime/record-change-publisher'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { runEffectSse } from '@/presentation/api/utils/effect-sse'
import { SSE_RESPONSE_HEADERS, enqueueSseMessage } from '@/presentation/api/utils/sse-stream'
import { parseSubscriptionFilter, changeEventMatchesFilter } from './subscription-filter'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables/table'
import type { Context } from 'hono'


const resolveReadableFields = (
  table: Table,
  effectiveRoles: readonly string[]
): readonly string[] | undefined => {
  const fieldPerms = table.permissions?.fields
  if (!fieldPerms || fieldPerms.length === 0) return undefined

  const isAdmin = effectiveRoles.includes('admin')
  const readableByAnyRole = (fieldName: string): boolean =>
    effectiveRoles.some((role) => {
      const evaluated = evaluateFieldPermissions(fieldPerms, role, isAdmin)
      const entry = evaluated[fieldName]
      return entry === undefined ? true : entry.read
    })

  const readable = table.fields.map((f) => f.name).filter(readableByAnyRole)
  return readable.length === table.fields.length ? undefined : readable
}


const pickRecordFields = (
  payload: unknown,
  whitelist: ReadonlySet<string> | undefined
): unknown => {
  if (!whitelist) return payload
  if (payload === null || typeof payload !== 'object') return payload
  const { id, fields: recordFields } = payload as {
    id?: unknown
    fields?: Record<string, unknown>
  }
  if (recordFields === undefined) return payload
  const filtered = Object.fromEntries(
    Object.entries(recordFields).filter(([key]) => whitelist.has(key))
  )
  return { id, fields: filtered }
}

const applyFieldSelection = (
  event: Record<string, unknown>,
  fields: readonly string[] | undefined
): Record<string, unknown> => {
  if (!fields) return event
  const whitelist = new Set(fields)
  return {
    ...event,
    ...(event['record'] !== undefined
      ? { record: pickRecordFields(event['record'], whitelist) }
      : {}),
    ...(event['oldRecord'] !== undefined
      ? { oldRecord: pickRecordFields(event['oldRecord'], whitelist) }
      : {}),
  }
}

const toWebSocketWireMessage = (
  event: Record<string, unknown>,
  readableFields: readonly string[] | undefined
): Record<string, unknown> => {
  if (event['event'] === 'delete') {
    return { type: 'delete', recordId: event['recordId'], table: event['table'] }
  }
  return applyFieldSelection(event, readableFields)
}


interface SubscriptionScope {
  readonly fields: readonly string[] | undefined
  readonly filter: ReturnType<typeof parseSubscriptionFilter>
}

const enqueue = enqueueSseMessage

const parseFieldSelection = (raw: string | undefined): readonly string[] | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const fields = raw
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0)
  return fields.length > 0 ? fields : undefined
}

const buildHandshakeStream = (tableName: string): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      enqueue(controller, { type: 'subscribed', table: tableName })
      enqueue(controller, { type: 'heartbeat', timestamp: new Date().toISOString() })
      controller.close()
    },
  })

const buildLiveResponse = (params: {
  readonly c: Context
  readonly appId: string
  readonly tableName: string
  readonly scope: SubscriptionScope
  readonly release: () => void
}): Response => {
  const { c, appId, tableName, scope, release } = params
  const source = Stream.async<Record<string, unknown>>((emit) => {
    const unsubscribe = addChannelListener(tableChannel(appId, tableName), (event) => {
      if (!changeEventMatchesFilter(event, scope.filter)) return
      void emit.single(applyFieldSelection(event, scope.fields))
    })
    return Effect.sync(() => unsubscribe())
  })

  return runEffectSse(c, source, (event) => ({ kind: 'data', payload: event }), {
    preamble: [
      { type: 'subscribed', table: tableName },
      { type: 'heartbeat', timestamp: new Date().toISOString() },
    ],
    onTerminate: release,
  })
}


const isWebSocketUpgrade = (c: Context): boolean =>
  (c.req.header('upgrade') ?? '').toLowerCase() === 'websocket'

interface SendableWebSocket {
  readonly send: (data: string) => unknown
}

interface WebSocketConnectionState {
  unsubscribe?: () => void
  heartbeat?: ReturnType<typeof setInterval>
}

const sendWebSocketMessage = (ws: SendableWebSocket, msg: Record<string, unknown>): void => {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
  }
}

const buildWebSocketEvents = (params: {
  readonly appId: string
  readonly tableName: string
  readonly readableFields: readonly string[] | undefined
  readonly release: () => void
}) => {
  const { appId, tableName, readableFields, release } = params
  const state: WebSocketConnectionState = {}

  return {
    onOpen(_event: Event, ws: SendableWebSocket): void {
      sendWebSocketMessage(ws, { type: 'subscribed', table: tableName })

      state.unsubscribe = addChannelListener(tableChannel(appId, tableName), (event) => {
        sendWebSocketMessage(ws, toWebSocketWireMessage(event, readableFields))
      })

      state.heartbeat = setInterval(() => {
        sendWebSocketMessage(ws, { type: 'heartbeat', timestamp: new Date().toISOString() })
      }, REALTIME_TRANSPORT_CONFIG.heartbeatIntervalMs)
    },
    onMessage(event: { data: unknown }, ws: SendableWebSocket): void {
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

const handleWebSocketUpgrade = (params: {
  readonly c: Context
  readonly appId: string
  readonly tableName: string
  readonly readableFields: readonly string[] | undefined
  readonly release: () => void
}): Promise<Response> => {
  const { c, appId, tableName, readableFields, release } = params
  const middleware = upgradeWebSocket(() =>
    buildWebSocketEvents({ appId, tableName, readableFields, release })
  )

  return Promise.resolve(middleware(c, async () => undefined)).then(
    (res) => res ?? new Response(undefined, { status: 426 })
  )
}


const buildSubscriptionHeaders = (
  filterExpr: string | undefined,
  fields: readonly string[] | undefined
): Record<string, string> => ({
  ...SSE_RESPONSE_HEADERS,
  ...(filterExpr !== undefined ? { 'X-Subscription-Filter': filterExpr } : {}),
  ...(fields !== undefined ? { 'X-Subscription-Fields': fields.join(',') } : {}),
})

const tooManyConnectionsResponse = (c: Context, current: number, limit: number): Response =>
  c.json(
    {
      success: false,
      message: `Concurrent connection limit reached (${current}/${limit}). Close an existing connection and retry.`,
      code: 'TOO_MANY_CONNECTIONS',
    },
    429,
    { 'Retry-After': '30' }
  )

interface LiveTransportInput {
  readonly c: Context
  readonly app: App
  readonly session: { readonly userId: string }
  readonly tableName: string
  readonly readableFields: readonly string[] | undefined
}

const openLiveTransport = (input: LiveTransportInput): Promise<Response> => {
  const { c, app, session, tableName, readableFields } = input
  const registration = registerConnection(session.userId)
  if (!registration.accepted) {
    return Promise.resolve(tooManyConnectionsResponse(c, registration.current, registration.limit))
  }
  if (isWebSocketUpgrade(c)) {
    return handleWebSocketUpgrade({
      c,
      appId: app.name,
      tableName,
      readableFields,
      release: registration.release,
    })
  }
  const fields = parseFieldSelection(c.req.query('fields'))
  const filterExpr = c.req.query('filter')
  const filter = parseSubscriptionFilter(filterExpr)
  if (filterExpr !== undefined) c.header('X-Subscription-Filter', filterExpr)
  if (fields !== undefined) c.header('X-Subscription-Fields', fields.join(','))
  return Promise.resolve(
    buildLiveResponse({
      c,
      appId: app.name,
      tableName,
      scope: { fields, filter },
      release: registration.release,
    })
  )
}

export async function handleSubscribe(c: Context, app: App): Promise<Response> {
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) {
    return c.json({ success: false, message: 'Table not found', code: 'NOT_FOUND' }, 404)
  }

  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  if (!hasReadPermissionForRoles(table, effectiveRoles, app.tables)) {
    return c.json({ success: false, message: 'Table not found', code: 'NOT_FOUND' }, 404)
  }

  const acceptsEventStream = (c.req.header('accept') ?? '').includes('text/event-stream')
  if (isWebSocketUpgrade(c) || acceptsEventStream) {
    return openLiveTransport({
      c,
      app,
      session,
      tableName,
      readableFields: resolveReadableFields(table, effectiveRoles),
    })
  }

  const fields = parseFieldSelection(c.req.query('fields'))
  const filterExpr = c.req.query('filter')
  return new Response(buildHandshakeStream(tableName), {
    status: 200,
    headers: buildSubscriptionHeaders(filterExpr, fields),
  })
}
