/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  ListRecent,
  MAX_RECENT_ITEMS,
  RecordRecent,
} from '@/application/use-cases/user-entity-lists'
import { provideUserEntityListsLive } from '@/presentation/api/routes/favorites/effect-runner'
import { parseEntityMutationBody } from '@/presentation/api/routes/user-entity-lists'
import { unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Context, Hono } from 'hono'


const resolveLimit = (c: Context): number => {
  const raw = c.req.query('limit')
  const parsed = raw === undefined ? MAX_RECENT_ITEMS : Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 1) return MAX_RECENT_ITEMS
  return Math.min(parsed, MAX_RECENT_ITEMS)
}

const handleList = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const limit = resolveLimit(c)

  const visible = await Effect.runPromise(
    ListRecent(session.userId, limit).pipe(provideUserEntityListsLive)
  )

  return c.json(visible, 200)
}

const handleAdd = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) {
    return c.json({ success: false, message: 'Invalid recent payload', code: 'BAD_REQUEST' }, 400)
  }

  await Effect.runPromise(RecordRecent(session.userId, input).pipe(provideUserEntityListsLive))

  return c.json({ success: true }, 201)
}

export function chainRecentRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.get('/api/recent', handleList).post('/api/recent', handleAdd) as T
}
