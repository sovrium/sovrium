/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  deleteUserTablePreferences,
  emptyPreferencesResponse,
  getUserTablePreferences,
  updateUserTablePreferences,
} from '@/application/use-cases/tables/user-table-preferences'
import {
  userTablePreferencesPatchSchema,
  userTablePreferencesResponseSchema,
} from '@/domain/models/api/tables/user-preferences'
import { notFound, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { provideDatabaseLive } from './user-table-preferences/effect-runner'
import type { Context, Hono } from 'hono'


const badRequest = (c: Context, message = 'Invalid preferences payload') =>
  c.json({ success: false, message, code: 'BAD_REQUEST' }, 400)

const internalError = (c: Context) =>
  c.json({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)

const handleGet = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const result = await Effect.runPromise(
    getUserTablePreferences({ userId: session.userId, tableName }).pipe(
      provideDatabaseLive,
      Effect.either
    )
  )
  if (result._tag === 'Left') return internalError(c)
  return c.json(userTablePreferencesResponseSchema.parse(result.right), 200)
}

const handleDelete = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const result = await Effect.runPromise(
    deleteUserTablePreferences({ userId: session.userId, tableName }).pipe(
      provideDatabaseLive,
      Effect.either
    )
  )
  if (result._tag === 'Left') return internalError(c)
  return c.json(userTablePreferencesResponseSchema.parse(emptyPreferencesResponse(tableName)), 200)
}

const handlePatch = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const body = await c.req.json().catch(() => undefined)
  if (!body || typeof body !== 'object') return badRequest(c)

  const parsed = userTablePreferencesPatchSchema.safeParse(body)
  if (!parsed.success) return badRequest(c)

  const result = await Effect.runPromise(
    updateUserTablePreferences({
      userId: session.userId,
      tableName,
      ...(parsed.data as Record<string, unknown>),
    }).pipe(provideDatabaseLive, Effect.either)
  )
  if (result._tag === 'Left') {
    if (result.left._tag === 'UserPreferencesWriteError') {
      return badRequest(c, result.left.message)
    }
    return internalError(c)
  }
  const { response, created } = result.right
  return c.json(userTablePreferencesResponseSchema.parse(response), created ? 201 : 200)
}

export function chainUserTablePreferenceRoutes<T extends Hono<any, any, any>>(honoApp: T): T {
  return honoApp
    .get('/api/tables/:tableId/user-preferences', handleGet)
    .patch('/api/tables/:tableId/user-preferences', handlePatch)
    .put('/api/tables/:tableId/user-preferences', handlePatch)
    .delete('/api/tables/:tableId/user-preferences', handleDelete) as T
}
