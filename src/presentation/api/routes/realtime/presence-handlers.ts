/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Stream } from 'effect'
import { addChannelListener } from '@/infrastructure/realtime/channel-manager'
import {
  joinPresence,
  leavePresence,
  presenceChannel,
  startPresenceReaper,
  touchPresence,
} from '@/infrastructure/realtime/presence-manager'
import { resolvePresenceUser } from '@/infrastructure/realtime/presence-queries'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { runEffectSse } from '@/presentation/api/utils/effect-sse'
import type { RealtimePresenceEntry } from '@/domain/models/api/realtime/realtime'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

export async function handlePresence(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) {
    return c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)
  }

  const pagePath = c.req.query('pagePath')
  if (pagePath === undefined || pagePath.trim() === '') {
    return c.json(
      { success: false, message: 'pagePath query parameter is required', code: 'BAD_REQUEST' },
      400
    )
  }

  startPresenceReaper()

  const userMeta = await resolvePresenceUser(session.userId)
  const entry: RealtimePresenceEntry = {
    id: session.userId,
    name: userMeta.name,
    pagePath,
    joinedAt: new Date().toISOString(),
    ...(userMeta.avatarUrl !== undefined ? { avatarUrl: userMeta.avatarUrl } : {}),
  }

  const connectionId = crypto.randomUUID()

  const appId = app.name
  const snapshot = joinPresence({ appId, connectionId, pagePath, entry })

  const source = Stream.async<Record<string, unknown>>((emit) => {
    const unsubscribe = addChannelListener(presenceChannel(appId, pagePath), (event) => {
      void emit.single(event)
    })
    return Effect.sync(() => unsubscribe())
  })

  return runEffectSse(c, source, (event) => ({ kind: 'data', payload: event }), {
    preamble: [{ type: 'presence-sync', pagePath, users: snapshot }],
    onHeartbeat: () => touchPresence({ appId, connectionId, pagePath }),
    onTerminate: () => leavePresence({ appId, connectionId, pagePath }),
  })
}
