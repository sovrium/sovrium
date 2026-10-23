/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The app connection — `GET /api/realtime/connection`, a WebSocket each open
 * page of a signed-in reader holds.
 *
 * Under `auth.presence` it is what makes a person online: her first open
 * connection announces her online, each close dates her `lastSeen` (when
 * `lastSeen` is on), and the close of her last announces her offline. Those `user-presence`
 * frames reach only the connections of readers whose role is in `visibleTo`;
 * an anonymous visitor holds no connection at all (401) and is never sent the
 * script that would open one.
 *
 * Each connection counts against its owner's presence pool (429 past it) and
 * ends with her session or a change to her grants, as a presence stream does.
 * It holds no queue: a frame is written to the socket as it is published, and
 * a socket that cannot take it drops it.
 *
 * A connection opened with `?table=&record=` also follows that record, once
 * its owner's read of it is admitted: the changes to its comment thread
 * (filtered as the thread is: a comment awaiting moderation reaches its
 * moderators and its author only), and, under `auth.presence.typing`, who
 * types under it, shown to readers in `visibleTo` by her display name.
 */

import { upgradeWebSocket } from 'hono/bun'
import {
  recordLastSeenProgram,
  typingNameOfProgram,
} from '@/application/use-cases/auth/user-presence-programs'
import { REALTIME_TRANSPORT_CONFIG } from '@/domain/models/api/realtime/realtime'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { seesPresence } from '@/domain/models/app/auth/presence-audience-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { logError } from '@/infrastructure/logging/logger'
import {
  appPresenceChannel,
  connectPerson,
  recordActivityChannel,
  disconnectPerson,
  userNotificationsChannel,
} from '@/infrastructure/realtime/app-connections'
import { addChannelListener, publishToChannel } from '@/infrastructure/realtime/channel-manager'
import { registerConnection } from '@/infrastructure/realtime/connection-counter'
import { unauthorized } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext, getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import { checkRecordReadGate } from './record-read-gate'
import { tooManyConnectionsResponse } from './subscribe-handlers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** The `send`/`close` surface of a Hono WebSocket context. */
interface Socket {
  readonly send: (data: string) => unknown
  readonly close: (code?: number, reason?: string) => void
}

/** Write one frame; a socket already closed drops it, and `onClose` tears it down. */
const sendFrame = (ws: Socket, frame: Readonly<Record<string, unknown>>): void => {
  try {
    ws.send(JSON.stringify(frame))
  } catch {
    // Connection already torn down.
  }
}

/** One connection's owner, as the frames it receives are judged. */
interface Owner {
  readonly c: Context
  readonly app: App
  readonly userId: string
  /** Whether her role is shown presence (`auth.presence.visibleTo`). */
  readonly sees: boolean
  /** Whether she moderates comments: she sees a change to one awaiting moderation. */
  readonly moderates: boolean
  /** The record this connection follows, once her read of it was admitted. */
  readonly watched: WatchedRecord | undefined
  /** Her display name, as her typing frames name her: read only when they can be sent. */
  readonly name: string | undefined
}

/** A record a connection follows: its comment changes and who types under it. */
interface WatchedRecord {
  readonly table: string
  readonly recordId: string
  /** The page the connection was opened on, as typing frames name it. */
  readonly pagePath: string
}

/** How long a typing indicator lasts after the last keystroke, and how often it is re-sent. */
const TYPING_EXPIRY_MS = 5000
const TYPING_THROTTLE_MS = 2000

/**
 * The record a connection asks to follow (`?table=&record=`), admitted only
 * when its owner may read it exactly as `GET /records/:id` would let her; a
 * record she may not read is followed by nobody, and nothing says why.
 */
const resolveWatchedRecord = async (c: Context, app: App): Promise<WatchedRecord | undefined> => {
  const tableKey = c.req.query('table')
  const recordId = c.req.query('record')
  if (tableKey === undefined || recordId === undefined || recordId === '') return undefined
  const table = app.tables?.find((t) => t.name === tableKey || String(t.id) === tableKey)
  if (table === undefined) return undefined
  const refused = await checkRecordReadGate(c, app, table, recordId)
  return refused === undefined
    ? { table: table.name, recordId, pagePath: c.req.query('page') ?? '' }
    : undefined
}

/**
 * The typing half of a connection: a `typing` frame on the record it follows,
 * re-sent at most every two seconds while she types, and withdrawn when she
 * stops, sends, or leaves — or on its own five seconds after her last keystroke.
 */
const typingRelay = (owner: Owner) => {
  const state: { timer?: ReturnType<typeof setTimeout>; sentAt: number } = { sentAt: 0 }
  const enabled =
    owner.app.auth?.presence?.typing === true && owner.sees && owner.watched !== undefined
  const publish = (typing: boolean): void => {
    if (owner.watched === undefined) return
    const { table, recordId, pagePath } = owner.watched
    publishToChannel(recordActivityChannel(owner.app.name, table, recordId), {
      type: 'typing',
      userId: owner.userId,
      ...(owner.name !== undefined && { name: owner.name }),
      pagePath,
      typing,
    })
  }
  const stop = (): void => {
    if (state.timer === undefined) return
    clearTimeout(state.timer)
    state.timer = undefined
    state.sentAt = 0
    publish(false)
  }
  const type = (): void => {
    if (state.timer !== undefined) clearTimeout(state.timer)
    state.timer = setTimeout(stop, TYPING_EXPIRY_MS)
    const now = Date.now()
    if (now - state.sentAt < TYPING_THROTTLE_MS) return
    state.sentAt = now
    publish(true)
  }
  return {
    receive: (message: { readonly type?: unknown; readonly typing?: unknown }): void => {
      if (!enabled || message.type !== 'typing') return
      if (message.typing === true) type()
      else stop()
    },
    stop,
  }
}

/**
 * The name her typing frames carry, read once when the connection opens and
 * only when it can send them: typing is on, she is shown presence, and the
 * connection follows a record. A name that cannot be read names nobody.
 */
const typingNameOf = async (
  c: Context,
  app: App,
  input: { readonly userId: string; readonly sees: boolean; readonly watched: unknown }
): Promise<string | undefined> => {
  if (app.auth?.presence?.typing !== true || !input.sees || input.watched === undefined) {
    return undefined
  }
  const read = await runOnRequest(c, typingNameOfProgram(input.userId))
  if (read._tag === 'Failure') {
    logError('[presence] a typing name could not be read; her frames name nobody', read.failure)
    return undefined
  }
  return read.success
}

/** Read a client frame as an object, or nothing. */
const parseClientFrame = (data: unknown): Readonly<Record<string, unknown>> => {
  if (typeof data !== 'string') return {}
  try {
    const parsed: unknown = JSON.parse(data)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Readonly<Record<string, unknown>>)
      : {}
  } catch {
    return {}
  }
}

/** Announce a person online or offline to the readers shown presence. */
const announcePresence = (owner: Owner, online: boolean, lastSeen: Date | undefined): void => {
  const presence = owner.app.auth?.presence
  if (presence === undefined) return
  publishToChannel(appPresenceChannel(owner.app.name), {
    type: 'user-presence',
    userId: owner.userId,
    online,
    ...(presence.lastSeen === true && { lastSeen: lastSeen?.toISOString() ?? null }),
  })
}

/**
 * One of her connections has closed: date her `lastSeen` first — every close,
 * so once she is offline it is the time her last connection closed, and a
 * reader who finds her offline finds that time with it — then count her out,
 * announcing her offline when it was her last.
 */
const closeConnection = async (owner: Owner): Promise<void> => {
  const seen = new Date()
  if (owner.app.auth?.presence?.lastSeen === true) {
    const written = await runOnRequest(owner.c, recordLastSeenProgram(owner.userId))
    if (written._tag === 'Failure') {
      logError('[presence] last-seen write failed; she reads as never seen', written.failure)
    }
  }
  if (disconnectPerson(owner.app.name, owner.userId)) announcePresence(owner, false, seen)
}

/**
 * The frame an event on the followed record sends this connection, or none:
 * someone else's typing, for a reader shown presence; a comment change, to
 * every reader when the comment is approved and otherwise to its moderators
 * and its author only — the change named, never its content.
 */
const recordFrameFor = (
  owner: Owner,
  event: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined => {
  if (event['type'] === 'typing') {
    return owner.sees && event['userId'] !== owner.userId ? event : undefined
  }
  const { frame, audience, authorId } = event
  if (typeof frame !== 'object' || frame === null) return undefined
  const admitted = audience === 'readers' || owner.moderates || authorId === owner.userId
  return admitted ? (frame as Readonly<Record<string, unknown>>) : undefined
}

/** Listen on the channels a connection receives from; answers how to stop. */
const listenFor = (owner: Owner, ws: Socket): readonly (() => void)[] => [
  addChannelListener(appPresenceChannel(owner.app.name), (frame) => {
    if (owner.sees) sendFrame(ws, frame)
  }),
  // Her own notifications changed: a bell re-reads them.
  addChannelListener(userNotificationsChannel(owner.userId), (frame) => sendFrame(ws, frame)),
  ...(owner.watched === undefined
    ? []
    : [
        addChannelListener(
          recordActivityChannel(owner.app.name, owner.watched.table, owner.watched.recordId),
          (event) => {
            const frame = recordFrameFor(owner, event)
            if (frame !== undefined) sendFrame(ws, frame)
          }
        ),
      ]),
]

/** The per-connection callbacks of one upgraded socket. */
const connectionEvents = (
  owner: Owner,
  registration: { readonly release: () => void; readonly bind: Bind }
) => {
  const teardown: {
    unsubscribes: readonly (() => void)[]
    heartbeat?: ReturnType<typeof setInterval>
  } = { unsubscribes: [] }
  const typing = typingRelay(owner)
  return {
    onOpen(_event: Event, ws: Socket): void {
      teardown.unsubscribes = listenFor(owner, ws)
      // Said once its listeners are in place: from here on, nothing it follows is missed.
      sendFrame(ws, { type: 'connection-status', status: 'connected', transport: 'websocket' })
      if (connectPerson(owner.app.name, owner.userId)) announcePresence(owner, true, undefined)
      teardown.heartbeat = setInterval(() => {
        sendFrame(ws, { type: 'heartbeat', timestamp: new Date().toISOString() })
      }, REALTIME_TRANSPORT_CONFIG.heartbeatIntervalMs)
      registration.bind({
        close: (cause) => {
          try {
            ws.close(cause.code, cause.reason)
          } catch {
            // Already closing — `onClose` runs the teardown path.
          }
        },
      })
    },
    onMessage(event: { readonly data: unknown }, ws: Socket): void {
      const message = parseClientFrame(event.data)
      if (message['type'] === 'ping' || event.data === 'ping') {
        sendFrame(ws, { type: 'pong', timestamp: new Date().toISOString() })
      }
      typing.receive(message)
    },
    onClose(): void {
      typing.stop()
      teardown.unsubscribes.forEach((unsubscribe) => unsubscribe())
      if (teardown.heartbeat) clearInterval(teardown.heartbeat)
      registration.release()
      void closeConnection(owner)
    },
  }
}

type Bind = Extract<ReturnType<typeof registerConnection>, { readonly accepted: true }>['bind']

/**
 * Handle `GET /api/realtime/connection`: a WebSocket for a signed-in reader,
 * 401 for anyone else, 426 for a request that does not ask for one.
 */
export async function handleAppConnection(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined || isGuestSession(session.userId)) return unauthorized(c)
  if ((c.req.header('upgrade') ?? '').toLowerCase() !== 'websocket') {
    return c.json(
      { success: false, message: 'WebSocket upgrade required', code: 'UPGRADE_REQUIRED' },
      426
    )
  }
  const { userRole } = getTableContext(c)
  const sees = seesPresence(app, { role: userRole, signedIn: true })
  const watched = await resolveWatchedRecord(c, app)
  const owner: Owner = {
    c,
    app,
    userId: session.userId,
    sees,
    moderates: isAdminEquivalent(userRole, app),
    watched,
    name: await typingNameOf(c, app, { userId: session.userId, sees, watched }),
  }
  const registration = registerConnection(session.userId, session.id, { pool: 'presence' })
  if (!registration.accepted) {
    return tooManyConnectionsResponse(c, registration.current, registration.limit)
  }
  const upgrade = upgradeWebSocket(() => connectionEvents(owner, registration))
  return Promise.resolve(upgrade(c, async () => undefined)).then((response) => {
    if (response !== undefined) return response
    // The handshake failed, so no socket will ever close: free its slot now.
    registration.release()
    return new Response(undefined, { status: 426 })
  })
}
