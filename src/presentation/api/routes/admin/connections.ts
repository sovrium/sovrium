/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin read endpoints for the **App Connections** family (the connection
 * browser + per-user token roster that backs `/_admin/data/connections`):
 *
 *   - GET /api/admin/connections      — the connection list, one row per
 *     `system.connections` row with its per-connection token/expiry summary +
 *     derived `status` badge.
 *   - GET /api/admin/connections/:id  — detail: the connection header + the
 *     per-user token roster (secret-free: `userId` + `expiresAt` + per-user
 *     `status`).
 *
 * Both read the RUNTIME DB rows in `system.connections` joined with the
 * per-connection token summary from `system.connection_tokens` (NOT the
 * `app.connections` config). Both emit exactly ONE
 * `connection.{list|detail}.queried` audit entry on success, with the canonical
 * `resource.type === 'connection'` (derived by the emit use-case from the action
 * catalog).
 *
 * Auth gating is wired upstream by `authMiddleware` + `requireAdminTier()` on
 * BOTH the `/api/admin/connections/*` wildcard AND the bare
 * `/api/admin/connections` path in `infrastructure/server/route-setup/
 * api-routes.ts`, which 404s both missing-session and wrong-role callers (S1
 * anti-enumeration). These handlers add only the per-connection anti-enum 404
 * (an unknown connection id is not an enumerable resource) and the success path.
 *
 * ⛔ SECURITY (S4 — absolute): the response is a HARD ALLOW-LIST. The use case
 * projects ONLY the allow-listed fields and validates against the `.strict()`
 * Zod schema, so `credentials` / `accessToken` / `refreshToken` can NEVER be
 * serialized.
 */

import { Effect } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import {
  BuildConnectionsList,
  BuildConnectionDetail,
} from '@/application/use-cases/admin/connections'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAdminConnectionsLive } from '@/presentation/api/routes/admin/connections/effect-runner'
import { requestLogAttributes } from '@/presentation/api/utils/context-helpers'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

const NOT_FOUND = { success: false, message: 'Not found', code: 'NOT_FOUND' } as const
const INTERNAL_ERROR = {
  success: false,
  message: 'Internal error',
  code: 'INTERNAL_ERROR',
} as const

/**
 * Sentinel resource id carried by the list-queried audit emit (the list read
 * has no single connection id). The spec asserts `resource.type === 'connection'`
 * — the canonical type comes from the action catalog, not this id. Mirrors the
 * `DEFAULT_BUCKET_ID` convention used by the bucket list emit.
 */
const CONNECTION_LIST_RESOURCE_ID = 'connections'

/**
 * GET /api/admin/connections handler — the connection list with per-connection
 * token/expiry summary + derived status badge.
 */
async function handleListConnections(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const result = await runRequestEffect(
    c,
    BuildConnectionsList.pipe(provideAdminConnectionsLive, Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[admin] connection-list lookup failed', result.failure, requestLogAttributes(c))
    return c.json(INTERNAL_ERROR, 500)
  }
  if (result.success._tag === 'ValidationFailed') {
    logError(
      '[admin] connection-list response validation failed',
      result.success.error,
      requestLogAttributes(c)
    )
    return c.json(INTERNAL_ERROR, 500)
  }

  // Emit one audit entry per call (canonical resource.type 'connection' —
  // derived by the emit use-case from the ACTION_CATALOG entry).
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
  await emitAuditEvent({
    action: AUDIT_ACTIONS.CONNECTION_LIST_QUERIED,
    actor,
    resourceId: CONNECTION_LIST_RESOURCE_ID,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(result.success.body, 200)
}

/**
 * GET /api/admin/connections/:id handler — the connection header + secret-free
 * per-user token roster.
 */
async function handleConnectionDetail(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const id = c.req.param('id')
  if (!id) return c.json(NOT_FOUND, 404)

  const result = await runRequestEffect(
    c,
    BuildConnectionDetail(id).pipe(provideAdminConnectionsLive, Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[admin] connection-detail lookup failed', result.failure, requestLogAttributes(c))
    return c.json(INTERNAL_ERROR, 500)
  }
  // Unknown connection id → anti-enum 404 (no audit emit on a miss — only
  // successful reads are audited).
  if (result.success._tag === 'NotFound') {
    return c.json(NOT_FOUND, 404)
  }
  if (result.success._tag === 'ValidationFailed') {
    logError(
      '[admin] connection-detail response validation failed',
      result.success.error,
      requestLogAttributes(c)
    )
    return c.json(INTERNAL_ERROR, 500)
  }

  // Emit one audit entry per call (canonical resource.type 'connection').
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
  await emitAuditEvent({
    action: AUDIT_ACTIONS.CONNECTION_DETAIL_QUERIED,
    actor,
    resourceId: id,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(result.success.body, 200)
}

/**
 * Chain the admin/connections read routes onto a Hono app.
 *
 * Auth gating is wired upstream in `createApiRoutes` (authMiddleware +
 * requireAdminTier on the `/api/admin/connections/*` wildcard AND the bare
 * `/api/admin/connections` path). Connection rows are read from the RUNTIME DB,
 * not `app.connections` config, so no live-App resolver is needed.
 *
 * Order matters — the more-specific `/:id` path is registered before the bare
 * list path so Hono routes the detail request to the detail handler (Hono routes
 * by registration order for `.get` overlaps). The single-segment `/:id` does not
 * overlap the two-segment `/:name/calls` registered by the metrics chain.
 */
export function chainAdminConnectionsRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/admin/connections/:id', (c) => handleConnectionDetail(c))
    .get('/api/admin/connections', (c) => handleListConnections(c)) as T
}
