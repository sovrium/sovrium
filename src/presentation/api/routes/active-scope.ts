/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { UserAccessRepository } from '@/application/ports/repositories/auth/user-access-repository'
import {
  cookieNameForScope,
  validateActiveAssignment,
} from '@/domain/services/active-assignment-cookie'
import { runUserAccessProgram } from '@/infrastructure/layers/table-layer'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'


interface ContextLike {
  readonly json: (body: unknown, status?: number) => Response
}

const respondNotFound = (c: ContextLike) =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

const respondUnauthorized = (c: ContextLike) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)

const respondForbidden = (c: ContextLike, _message: string) =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

const respondBadRequest = (c: ContextLike, message: string) =>
  c.json({ success: false, message, code: 'BAD_REQUEST' }, 400)

const respondServerError = (c: ContextLike) =>
  c.json({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)

const getScopeTablesIfEnabled = (app: App): readonly string[] | undefined => {
  const scopeTables = app.auth?.scopeTables
  if (!scopeTables || scopeTables.length === 0) return undefined
  return scopeTables
}

const fetchAccessibleRecordIds = async (
  userId: string,
  tableSlug: string
): Promise<readonly string[]> => {
  const result = await runUserAccessProgram(
    Effect.gen(function* () {
      const repo = yield* UserAccessRepository
      return yield* repo.list({ userId })
    })
  )
  if (result._tag === 'Left') return []
  return result.right.filter((row) => row.tableSlug === tableSlug).flatMap((row) => row.recordIds)
}

interface PostBody {
  readonly recordId?: unknown
}

async function handleSetActiveScope(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) return respondUnauthorized(c)

  const scopeTables = getScopeTablesIfEnabled(app)
  if (!scopeTables) return respondNotFound(c)

  const tableSlug = c.req.param('tableSlug')
  if (!tableSlug || !scopeTables.includes(tableSlug)) return respondNotFound(c)

  const body = (await c.req.json().catch(() => ({}))) as PostBody
  const { recordId } = body
  if (typeof recordId !== 'string' || recordId.length === 0) {
    return respondBadRequest(c, 'recordId is required and must be a non-empty string')
  }

  const accessible = await fetchAccessibleRecordIds(session.userId, tableSlug)
  if (validateActiveAssignment(recordId, accessible) === undefined) {
    return respondForbidden(c, 'recordId is not in your accessible scope')
  }

  setCookie(c, cookieNameForScope(tableSlug), recordId, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: process.env['NODE_ENV'] === 'production',
  })

  return c.json({ tableSlug, recordId }, 200)
}

async function handleGetActiveScope(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) return respondUnauthorized(c)

  const scopeTables = getScopeTablesIfEnabled(app)
  if (!scopeTables) return respondNotFound(c)

  const tableSlug = c.req.param('tableSlug')
  if (!tableSlug || !scopeTables.includes(tableSlug)) return respondNotFound(c)

  const cookieValue = getCookie(c, cookieNameForScope(tableSlug))
  if (!cookieValue) {
    return c.json({ tableSlug, recordId: null }, 200)
  }

  const accessible = await fetchAccessibleRecordIds(session.userId, tableSlug)
  const validated = validateActiveAssignment(cookieValue, accessible)
  if (validated === undefined) {
    return c.json({ tableSlug, recordId: null }, 200)
  }

  return c.json({ tableSlug, recordId: validated }, 200)
}

async function handleClearActiveScope(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) return respondUnauthorized(c)

  const scopeTables = getScopeTablesIfEnabled(app)
  if (!scopeTables) return respondNotFound(c)

  const tableSlug = c.req.param('tableSlug')
  if (!tableSlug || !scopeTables.includes(tableSlug)) return respondNotFound(c)

  deleteCookie(c, cookieNameForScope(tableSlug), {
    path: '/',
  })

  return c.body(null, 204)
}

const safeHandler =
  (handler: (c: Context, app: App) => Promise<Response>, app: App) =>
  async (c: Context): Promise<Response> => {
    try {
      return await handler(c, app)
    } catch {
      return respondServerError(c)
    }
  }

export function chainActiveScopeRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .post('/api/session/active-scope/:tableSlug', safeHandler(handleSetActiveScope, app))
    .get('/api/session/active-scope/:tableSlug', safeHandler(handleGetActiveScope, app))
    .delete('/api/session/active-scope/:tableSlug', safeHandler(handleClearActiveScope, app)) as T
}
