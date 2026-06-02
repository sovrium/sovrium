/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { BuildUsersOverview } from '@/application/use-cases/admin/users-overview'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { usersOverviewQuerySchema } from '@/domain/models/api/admin/users'
import { provideUsersOverviewLive } from '@/presentation/api/routes/admin/users-overview/effect-runner'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'



async function handleUsersOverview(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedQuery = usersOverviewQuerySchema.safeParse({
    period: c.req.query('period'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const { period } = parsedQuery.data

  const outcome = await Effect.runPromise(BuildUsersOverview(period).pipe(provideUsersOverviewLive))

  if (outcome._tag === 'ValidationFailed') {
    console.error('[admin] users overview response validation failed', outcome.error)
    return c.json(
      { success: false, message: 'Failed to build users overview', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.USER_OVERVIEW_QUERIED,
    actor,
    resourceId: session.userId,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(outcome.body, 200)
}


export function chainAdminUsersRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.get('/api/admin/users/overview', handleUsersOverview) as T
}

