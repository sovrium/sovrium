/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/audit-log` route handler.
 *
 * Reads the canonical audit-log entry list, optionally filtered by `actorId`,
 * `action`, `transport` and/or `resourceType` query parameters. Phase 0 keeps
 * the response shape small (`{ items: [...] }`) — pagination is deferred per
 * the keystone story.
 *
 * Auth gating is handled upstream by `requireAdminTier()` in `api-routes.ts`.
 */

import { listAuditEvents } from '@/application/use-cases/admin/audit-log/emit'
import {
  auditLogListResponseSchema,
  type AuditLogListResponse,
} from '@/domain/models/api/admin/audit-log/entry'
import type { Context } from 'hono'

/**
 * Handle `GET /api/admin/audit-log`.
 *
 * Query params:
 * - `actorId`   — only entries whose `actor.id` matches
 * - `action`    — only entries whose `action` exactly matches
 * - `transport` — only entries made through that transport ("canal")
 *   (`config-file | env | api | mcp | restore`). A transport with no entries
 *   returns 200 with an empty item set — an explicit empty state, not an error
 *.
 * - `resourceType` — only entries whose `resource.type` exactly matches
 *   (`config`, `form`, `form.submission`, …). Exact, never prefix: `form` must
 *   not sweep in the compound `form.submission`. The value set is open (every
 *   new `ACTION_CATALOG` row may add one), so an unrecognised value matches
 *   nothing and returns 200 with an empty item set — same empty-state contract
 *   as `transport`, never a 400.
 *
 * All supplied filters combine conjunctively — a returned entry satisfies every
 * one of them.
 */
export async function handleGetAuditLog(c: Context): Promise<Response> {
  const actorId = c.req.query('actorId')
  const action = c.req.query('action')
  const transport = c.req.query('transport')
  const resourceType = c.req.query('resourceType')

  const items = await listAuditEvents({
    ...(actorId ? { actorId } : {}),
    ...(action ? { action } : {}),
    ...(transport ? { transport } : {}),
    ...(resourceType ? { resourceType } : {}),
  })

  // nextCursor: null per the canonical cursor-pagination contract. Lane A's
  // Phase-0 audit-log route returns all matching entries in a single page,
  // so there is no next page. Lane B's store.ts paginates and emits a real
  // cursor when more entries exist.
  // eslint-disable-next-line unicorn/no-null -- cursor contract requires `null` over `undefined` (matches Lane B's store.ts emit).
  const response: AuditLogListResponse = { items: items.slice(), nextCursor: null }

  // Validate the response against the canonical schema (defence-in-depth).
  const parsed = auditLogListResponseSchema.safeParse(response)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build audit-log response', code: 'INTERNAL_ERROR' },
      500
    )
  }

  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}

/**
 * Chain `GET /api/admin/audit-log` onto a Hono instance.
 *
 * Added in [internal ref] merge to satisfy Lane B's `api-routes.ts` import
 * expectation (Lane B's pattern uses chain-helper exports across all admin
 * routes; Lane A originally wired this route inline). Auth gating remains
 * upstream via `requireAdminTier()` in `api-routes.ts`.
 */
export const chainAdminAuditLogRoutes = <
  T extends { get: (path: string, handler: typeof handleGetAuditLog) => unknown },
>(
  app: T
): T => {
  // eslint-disable-next-line functional/no-expression-statements -- Hono chaining is mutation-by-design
  app.get('/api/admin/audit-log', handleGetAuditLog)
  return app
}
