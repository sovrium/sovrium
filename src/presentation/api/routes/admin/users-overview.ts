/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { gte, sql } from 'drizzle-orm'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { resolvePeriodWindow } from '@/domain/models/api/admin/_shared/period-preset'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  usersOverviewQuerySchema,
  usersOverviewResponseSchema,
  type UsersOverviewResponse,
  type UsersOverviewSeriesPoint,
} from '@/domain/models/api/admin/users'
import { db } from '@/infrastructure/database'
import { authSessionsTable, authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'



const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

function tsToMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return new Date(value).getTime()
}

function buildDenseSeries(
  fromIso: string,
  toIso: string,
  interval: '1h' | '1d',
  rowsByBucket: ReadonlyMap<string, { readonly signups: number; readonly sessions_started: number }>
): readonly UsersOverviewSeriesPoint[] {
  const stepMs = interval === '1h' ? HOUR_MS : DAY_MS
  const fromMs = new Date(fromIso).getTime()
  const toMs = new Date(toIso).getTime()
  const firstBucketMs = Math.floor(fromMs / stepMs) * stepMs
  const lastBucketMs = Math.floor(toMs / stepMs) * stepMs
  const expectedCount = Math.max(1, Math.round((lastBucketMs - firstBucketMs) / stepMs) + 1)
  const points: UsersOverviewSeriesPoint[] = []
  for (let i = 0; i < expectedCount; i += 1) {
    const bucketMs = firstBucketMs + i * stepMs
    const timestamp = new Date(bucketMs).toISOString()
    const found = rowsByBucket.get(timestamp)
    points.push({
      timestamp,
      signups: found?.signups ?? 0,
      sessions_started: found?.sessions_started ?? 0,
    })
  }
  return points
}

function bucketTimestamps(
  rows: ReadonlyArray<{ readonly createdAt: Date | string | number }>,
  fromMs: number,
  stepMs: number
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const tsMs = tsToMs(row.createdAt)
    if (tsMs < fromMs) continue
    const bucketMs = Math.floor(tsMs / stepMs) * stepMs
    const key = new Date(bucketMs).toISOString()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}


function classifyRole(raw: string | null | undefined): 'admin' | 'operator' | 'member' {
  if (raw === 'admin') return 'admin'
  if (raw === 'operator') return 'operator'
  return 'member'
}


async function handleUsersOverview(c: Context): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedQuery = usersOverviewQuerySchema.safeParse({
    period: c.req.query('period'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const { period } = parsedQuery.data
  const window = resolvePeriodWindow(period)
  const fromDate = new Date(window.from)
  const fromMs = fromDate.getTime()
  const nowMs = Date.now()
  const last24hMs = nowMs - 24 * HOUR_MS
  const last24hDate = new Date(last24hMs)

  const usersTable = authUsersTable()
  const sessionsTable = authSessionsTable()

  const allUserRoles = (await db
    .select({ role: usersTable.role, createdAt: usersTable.createdAt })
    .from(usersTable)) as ReadonlyArray<{
    role: string | null
    createdAt: Date | string | number
  }>

  let totalUsers = 0
  let admins = 0
  let operators = 0
  let members = 0
  let newInPeriod = 0
  const signupRowsInPeriod: { readonly createdAt: Date | string | number }[] = []
  for (const row of allUserRoles) {
    totalUsers += 1
    const cls = classifyRole(row.role)
    if (cls === 'admin') admins += 1
    else if (cls === 'operator') operators += 1
    else members += 1
    const tsMs = tsToMs(row.createdAt)
    if (tsMs >= fromMs) {
      newInPeriod += 1
      signupRowsInPeriod.push({ createdAt: row.createdAt })
    }
  }

  const active24hRows = (await db
    .select({ count: sql<number>`COUNT(DISTINCT ${sessionsTable.userId})` })
    .from(sessionsTable)
    .where(gte(sessionsTable.createdAt, last24hDate))) as ReadonlyArray<{ count: number | string }>
  const active24hRaw = active24hRows[0]?.count ?? 0
  const active24h =
    typeof active24hRaw === 'number' ? active24hRaw : Number.parseInt(String(active24hRaw), 10) || 0

  const sessionRowsInPeriod = (await db
    .select({ createdAt: sessionsTable.createdAt })
    .from(sessionsTable)
    .where(gte(sessionsTable.createdAt, fromDate))) as ReadonlyArray<{
    createdAt: Date | string | number
  }>

  const stepMs = window.interval === '1h' ? HOUR_MS : DAY_MS
  const signupsByBucket = bucketTimestamps(signupRowsInPeriod, fromMs, stepMs)
  const sessionsByBucket = bucketTimestamps(sessionRowsInPeriod, fromMs, stepMs)

  const merged = new Map<string, { signups: number; sessions_started: number }>()
  for (const [key, value] of signupsByBucket) {
    const entry = merged.get(key) ?? { signups: 0, sessions_started: 0 }
    entry.signups = value
    merged.set(key, entry)
  }
  for (const [key, value] of sessionsByBucket) {
    const entry = merged.get(key) ?? { signups: 0, sessions_started: 0 }
    entry.sessions_started = value
    merged.set(key, entry)
  }
  const points = buildDenseSeries(window.from, window.to, window.interval, merged)

  const body: UsersOverviewResponse = {
    totals: {
      users: totalUsers,
      active_24h: active24h,
      new_in_period: newInPeriod,
      by_role: {
        admin: admins,
        operator: operators,
        member: members,
      },
    },
    series: {
      interval: window.interval,
      points: [...points],
    },
  }

  const parsed = usersOverviewResponseSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[admin] users overview response validation failed', parsed.error)
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
  return c.json(parsed.data, 200)
}


export function chainAdminUsersRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.get('/api/admin/users/overview', handleUsersOverview) as T
}

