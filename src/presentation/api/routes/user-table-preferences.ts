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
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { provideDatabaseLive } from './user-table-preferences/effect-runner'
import type { Context, Hono } from 'hono'

/**
 * Personal Table Preferences API routes (PG-03 / [internal ref],
 * [internal ref]).
 *
 *   - `GET    /api/tables/:tableId/user-preferences` — read the caller's preferences
 *   - `PATCH  /api/tables/:tableId/user-preferences` — update preferences (upsert)
 *   - `PUT    /api/tables/:tableId/user-preferences` — alias for PATCH (same upsert)
 *   - `DELETE /api/tables/:tableId/user-preferences` — clear preferences
 *
 * Phase 8 Cycle 2 — handlers consume Effect.gen programs from
 * `@/application/use-cases/tables/user-table-preferences`; responses are
 * shaped by `userTablePreferencesResponseSchema` for OpenAPI-contract
 * enforcement (S4).
 */

/** Canonical 400 envelope for malformed JSON or shape mismatches. */
const badRequest = (c: Context, message = 'Invalid preferences payload') =>
  c.json({ success: false, message, code: 'BAD_REQUEST' }, 400)

const internalError = (c: Context) =>
  c.json({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)

/** GET /api/tables/:tableId/user-preferences — read prefs for caller+table. */
const handleGet = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const result = await runRequestEffect(
    c,
    getUserTablePreferences({ userId: session.userId, tableName }).pipe(
      provideDatabaseLive,
      Effect.result
    )
  )
  if (result._tag === 'Failure') return internalError(c)
  return c.json(userTablePreferencesResponseSchema.parse(result.success), 200)
}

/** DELETE /api/tables/:tableId/user-preferences — clear all preferences. */
const handleDelete = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const result = await runRequestEffect(
    c,
    deleteUserTablePreferences({ userId: session.userId, tableName }).pipe(
      provideDatabaseLive,
      Effect.result
    )
  )
  if (result._tag === 'Failure') return internalError(c)
  return c.json(userTablePreferencesResponseSchema.parse(emptyPreferencesResponse(tableName)), 200)
}

/** PATCH /api/tables/:tableId/user-preferences — upsert preferences. */
const handlePatch = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const body = await c.req.json().catch(() => undefined)
  if (!body || typeof body !== 'object') return badRequest(c)

  // Phase 7 Cycle 3 — strict body validation: reject unknown keys, bad
  // `rowDensity` enums, and column-widths shapes that are not flat numeric
  // records. Returns the canonical 400 envelope on failure.
  const parsed = userTablePreferencesPatchSchema.safeParse(body)
  if (!parsed.success) return badRequest(c)

  const result = await runRequestEffect(
    c,
    updateUserTablePreferences({
      userId: session.userId,
      tableName,
      ...(parsed.data as Record<string, unknown>),
    }).pipe(provideDatabaseLive, Effect.result)
  )
  if (result._tag === 'Failure') {
    if (result.failure._tag === 'UserPreferencesWriteError') {
      return badRequest(c, result.failure.message)
    }
    return internalError(c)
  }
  const { response, created } = result.success
  return c.json(userTablePreferencesResponseSchema.parse(response), created ? 201 : 200)
}

/**
 * Chain user-table-preferences routes onto a Hono app.
 *
 * Mounted under `/api/tables/:tableId/user-preferences`. Auth + `validateTable`
 * middleware come from the table-route chain.
 *
 * Both PATCH and PUT route to the same upsert handler — the route also accepts
 * PUT so callers that prefer "set the whole resource" semantics (Playwright's
 * `request.put()` in user-preferences specs) can hit the same upsert merge
 * without a separate code path.
 */
/* eslint-disable drizzle/enforce-delete-with-where -- The `.delete()` below is
   a Hono route registration, NOT a Drizzle DELETE; rule's regex match is a
   false positive on the method-name shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono types
export function chainUserTablePreferenceRoutes<T extends Hono<any, any, any>>(honoApp: T): T {
  return honoApp
    .get('/api/tables/:tableId/user-preferences', handleGet)
    .patch('/api/tables/:tableId/user-preferences', handlePatch)
    .put('/api/tables/:tableId/user-preferences', handlePatch)
    .delete('/api/tables/:tableId/user-preferences', handleDelete) as T
}
/* eslint-enable drizzle/enforce-delete-with-where */
