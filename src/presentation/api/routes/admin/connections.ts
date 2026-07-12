/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import {
  BuildConnectionsList,
  BuildConnectionDetail,
} from '@/application/use-cases/admin/connections'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { provideAdminConnectionsLive } from '@/presentation/api/routes/admin/connections/effect-runner'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

const NOT_FOUND = { success: false, message: 'Not found', code: 'NOT_FOUND' } as const
const INTERNAL_ERROR = {
  success: false,
  message: 'Internal error',
  code: 'INTERNAL_ERROR',
} as const

const CONNECTION_LIST_RESOURCE_ID = 'connections'

async function handleListConnections(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const result = await Effect.runPromise(
    BuildConnectionsList().pipe(provideAdminConnectionsLive, Effect.either)
  )
  if (result._tag === 'Left') {
    console.error('[admin] connection-list lookup failed', result.left)
    return c.json(INTERNAL_ERROR, 500)
  }
  if (result.right._tag === 'ValidationFailed') {
    console.error('[admin] connection-list response validation failed', result.right.error)
    return c.json(INTERNAL_ERROR, 500)
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.CONNECTION_LIST_QUERIED,
    actor,
    resourceId: CONNECTION_LIST_RESOURCE_ID,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(result.right.body, 200)
}

async function handleConnectionDetail(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const id = c.req.param('id')
  if (!id) return c.json(NOT_FOUND, 404)

  const result = await Effect.runPromise(
    BuildConnectionDetail(id).pipe(provideAdminConnectionsLive, Effect.either)
  )
  if (result._tag === 'Left') {
    console.error('[admin] connection-detail lookup failed', result.left)
    return c.json(INTERNAL_ERROR, 500)
  }
  if (result.right._tag === 'NotFound') {
    return c.json(NOT_FOUND, 404)
  }
  if (result.right._tag === 'ValidationFailed') {
    console.error('[admin] connection-detail response validation failed', result.right.error)
    return c.json(INTERNAL_ERROR, 500)
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.CONNECTION_DETAIL_QUERIED,
    actor,
    resourceId: id,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(result.right.body, 200)
}

export function chainAdminConnectionsRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/admin/connections/:id', (c) => handleConnectionDetail(c))
    .get('/api/admin/connections', (c) => handleListConnections(c)) as T
}
