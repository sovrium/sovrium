/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  createUserView,
  deleteUserView,
  getSharedView,
  listUserViews,
  updateUserView,
} from '@/application/use-cases/tables/user-views'
import {
  userViewPatchSchema,
  userViewResponseSchema,
  userViewsListResponseSchema,
} from '@/domain/models/api/tables/user-views'
import { notFound, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { provideDatabaseLive } from './user-views/effect-runner'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'


const badRequest = (c: Context, message = 'Invalid view payload') =>
  c.json({ success: false, message, code: 'BAD_REQUEST' }, 400)

const conflict = (c: Context, message = 'A view with that name already exists') =>
  c.json({ success: false, message, code: 'CONFLICT' }, 409)

const internalError = (c: Context) =>
  c.json({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)

interface SavedViewPayload {
  readonly name: string
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  readonly baseViewId?: string | number
  readonly isDefault?: boolean
}

const parseCreatePayload = (body: unknown): SavedViewPayload | undefined => {
  if (!body || typeof body !== 'object') return undefined
  const b = body as Record<string, unknown>
  if (typeof b['name'] !== 'string' || b['name'].trim() === '') return undefined
  return {
    name: b['name'],
    filters: b['filters'],
    sorts: b['sorts'],
    fields: b['fields'],
    groupBy: b['groupBy'],
    baseViewId: b['baseViewId'] as string | number | undefined,
    isDefault: b['isDefault'] === true,
  }
}

const parsePatchBody = async (c: Context): Promise<Record<string, unknown> | undefined> => {
  const body = await c.req.json().catch(() => undefined)
  if (!body || typeof body !== 'object') return undefined
  const parsed = userViewPatchSchema.safeParse(body)
  if (!parsed.success) return undefined
  return parsed.data as Record<string, unknown>
}

const handleList = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const result = await Effect.runPromise(
    listUserViews({ userId: session.userId, tableName }).pipe(provideDatabaseLive, Effect.either)
  )
  if (result._tag === 'Left') return internalError(c)
  return c.json(userViewsListResponseSchema.parse(result.right), 200)
}

const handleCreate = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const body = await c.req.json().catch(() => undefined)
  const payload = parseCreatePayload(body)
  if (!payload) return badRequest(c)

  const result = await Effect.runPromise(
    createUserView({ userId: session.userId, tableName, ...payload }).pipe(
      provideDatabaseLive,
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    if (result.left._tag === 'UserViewConflictError') return conflict(c)
    if (result.left._tag === 'UserViewNotFoundError') return badRequest(c, 'Failed to create view')
    return internalError(c)
  }
  return c.json(userViewResponseSchema.parse(result.right), 201)
}

const handleUpdate = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  const viewId = c.req.param('viewId')
  if (!tableName || !viewId) return notFound(c, 'View not found')

  const b = await parsePatchBody(c)
  if (!b) return badRequest(c)

  const result = await Effect.runPromise(
    updateUserView({
      userId: session.userId,
      tableName,
      viewId,
      name: typeof b['name'] === 'string' ? b['name'] : undefined,
      isDefault: typeof b['isDefault'] === 'boolean' ? b['isDefault'] : undefined,
      filters: b['filters'],
      sorts: b['sorts'],
      fields: b['fields'],
      groupBy: b['groupBy'] as string | null | undefined,
      baseViewId: b['baseViewId'] as string | number | null | undefined,
    }).pipe(provideDatabaseLive, Effect.either)
  )
  if (result._tag === 'Left') {
    if (result.left._tag === 'UserViewConflictError') return conflict(c)
    if (result.left._tag === 'UserViewNotFoundError') return notFound(c, 'View not found')
    return internalError(c)
  }
  return c.json(userViewResponseSchema.parse(result.right), 200)
}

const handleDelete = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  const viewId = c.req.param('viewId')
  if (!tableName || !viewId) return notFound(c, 'View not found')

  const result = await Effect.runPromise(
    deleteUserView({ userId: session.userId, tableName, viewId }).pipe(
      provideDatabaseLive,
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    if (result.left._tag === 'UserViewNotFoundError') return notFound(c, 'View not found')
    return internalError(c)
  }
  return c.json({ success: true }, 200)
}

export function chainUserViewRoutes<T extends Hono<any, any, any>>(honoApp: T): T {
  return (
    honoApp
      .get('/api/tables/:tableId/user-views', handleList)
      .post('/api/tables/:tableId/user-views', handleCreate)
      .patch('/api/tables/:tableId/user-views/:viewId', handleUpdate)
      .put('/api/tables/:tableId/user-views/:viewId', handleUpdate)
      .delete('/api/tables/:tableId/user-views/:viewId', handleDelete) as T
  )
}

const handleShared = async (c: Context, app: App): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const viewId = c.req.param('viewId')
  if (!viewId) return notFound(c, 'View not found')

  const result = await Effect.runPromise(
    getSharedView({ userId: session.userId, viewId, app }).pipe(provideDatabaseLive, Effect.either)
  )
  if (result._tag === 'Left') {
    if (
      result.left._tag === 'UserViewNotFoundError' ||
      result.left._tag === 'UserViewForbiddenError'
    ) {
      return notFound(c, 'View not found')
    }
    return internalError(c)
  }
  return c.json(userViewResponseSchema.parse(result.right), 200)
}

export function chainSharedViewRoute<T extends Hono<any, any, any>>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp.get('/api/shared-views/:viewId', (c) => handleShared(c, resolveApp())) as T
}
