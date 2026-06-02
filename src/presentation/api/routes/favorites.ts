/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AddFavorite,
  ListFavorites,
  RemoveFavorite,
} from '@/application/use-cases/user-entity-lists'
import { provideUserEntityListsLive } from '@/presentation/api/routes/favorites/effect-runner'
import { parseEntityMutationBody } from '@/presentation/api/routes/user-entity-lists'
import { unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Context, Hono } from 'hono'


const badRequest = (c: Context) =>
  c.json({ success: false, message: 'Invalid favorite payload', code: 'BAD_REQUEST' }, 400)

const handleList = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const visible = await Effect.runPromise(
    ListFavorites(session.userId).pipe(provideUserEntityListsLive)
  )

  return c.json(visible, 200)
}

const handleAdd = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) return badRequest(c)

  await Effect.runPromise(AddFavorite(session.userId, input).pipe(provideUserEntityListsLive))
  return c.json({ success: true }, 201)
}

const handleRemove = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) return badRequest(c)

  await Effect.runPromise(RemoveFavorite(session.userId, input).pipe(provideUserEntityListsLive))

  return c.json({ success: true }, 200)
}

export function chainFavoriteRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/favorites', handleList)
    .post('/api/favorites', handleAdd)
    .delete('/api/favorites', handleRemove) as T
}
