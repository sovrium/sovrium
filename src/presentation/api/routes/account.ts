/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  CancelAccountDeletion,
  ExportAccount,
  GRACE_PERIOD_DAYS,
  LoadPendingErasure,
  ScheduleAccountDeletion,
} from '@/application/use-cases/account'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { accountDeleteRequestSchema } from '@/domain/models/api/account/account'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { purgeDueAccounts } from '@/infrastructure/database/account-purge'
import { provideAccountLive } from '@/presentation/api/routes/account/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'


const SCHEDULER_TOKEN_ENV = 'INTERNAL_SCHEDULER_TOKEN'

const SCHEDULER_TOKEN_HEADER = 'X-Internal-Scheduler-Token'

const unauthorized = (c: Context) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)


async function handleExport(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)
  const { userId } = session

  const outcome = await Effect.runPromise(
    ExportAccount(
      userId,
      (app.tables ?? []).map((t) => t.name)
    ).pipe(provideAccountLive)
  )
  if (outcome._tag === 'Unauthorized') return unauthorized(c)
  return c.json(outcome.body, 200)
}


async function handlePendingErasure(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)

  const body = await Effect.runPromise(LoadPendingErasure(session.userId).pipe(provideAccountLive))
  return c.json(body, 200)
}


async function handleDelete(c: Context): Promise<Response> {
  const session = getSessionContext(c)
  if (session === undefined) return unauthorized(c)
  const { userId } = session

  const rawBody = await c.req.json().catch(() => undefined)
  const parsed = accountDeleteRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'A confirm or cancel flag is required', code: 'BAD_REQUEST' },
      400
    )
  }

  if ('cancel' in parsed.data) {
    const body = await Effect.runPromise(CancelAccountDeletion(userId).pipe(provideAccountLive))
    return c.json(body, 200)
  }

  const result = await Effect.runPromise(ScheduleAccountDeletion(userId).pipe(provideAccountLive))

  const actor = await resolveActor(userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.ACCOUNT_DELETION_SCHEDULED,
    actor,
    resourceId: userId,
    severity: 'critical',
    result: 'success',
    metadata: {
      gracePeriodDays: GRACE_PERIOD_DAYS,
      scheduledErasureAt: result.scheduledErasureAt.toISOString(),
    },
  })

  return c.json(result.body, 202)
}


function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}

async function handlePurgeDue(c: Context, app: App): Promise<Response> {
  const expectedToken = process.env[SCHEDULER_TOKEN_ENV]
  if (expectedToken === undefined || expectedToken.length === 0) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  const providedToken = c.req.header(SCHEDULER_TOKEN_HEADER)
  if (providedToken === undefined || !tokensMatch(providedToken, expectedToken)) {
    return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
  }

  const purgedCount = await purgeDueAccounts((app.tables ?? []).map((t) => t.name))
  return c.json({ status: 'ok', purgedCount }, 200)
}

export function chainAccountRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .get('/api/account/export', async (c) => handleExport(c, app))
    .get('/api/account/pending-erasure', async (c) => handlePendingErasure(c))
    .post('/api/account/delete', async (c) => handleDelete(c))
    .post('/api/account/purge-due', async (c) => handlePurgeDue(c, app)) as T
}
