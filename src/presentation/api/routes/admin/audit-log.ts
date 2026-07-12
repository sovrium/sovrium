/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { listAuditEvents } from '@/application/use-cases/admin/audit-log/emit'
import {
  auditLogListResponseSchema,
  type AuditLogListResponse,
} from '@/domain/models/api/admin/audit-log/entry'
import type { Context } from 'hono'

export async function handleGetAuditLog(c: Context): Promise<Response> {
  const actorId = c.req.query('actorId')
  const action = c.req.query('action')
  const transport = c.req.query('transport')

  const items = await listAuditEvents({
    ...(actorId ? { actorId } : {}),
    ...(action ? { action } : {}),
    ...(transport ? { transport } : {}),
  })

  const response: AuditLogListResponse = { items: items.slice(), nextCursor: null }

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

export const chainAdminAuditLogRoutes = <
  T extends { get: (path: string, handler: typeof handleGetAuditLog) => unknown },
>(
  app: T
): T => {
  app.get('/api/admin/audit-log', handleGetAuditLog)
  return app
}
