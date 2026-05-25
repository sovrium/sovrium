/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { resolvePeriodWindow } from '@/domain/models/api/admin/_shared/period-preset'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  automationsOverviewQuerySchema,
  automationsOverviewResponseSchema,
  automationsRunsDetailParamsSchema,
  automationsRunsDetailResponseSchema,
  automationsRunsListQuerySchema,
  automationsRunsListResponseSchema,
  type AutomationRunAdminItem,
  type AutomationsOverviewResponse,
  type AutomationsOverviewSeriesPoint,
} from '@/domain/models/api/admin/automations'
import { runStatusSchema, type RunStatus } from '@/domain/models/api/automations'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDefinitions as automationDefinitionsPg,
  automationRuns as automationRunsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationRuns as automationRunsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'


const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)
const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)


function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function coerceStatus(raw: unknown): RunStatus {
  const parsed = runStatusSchema.safeParse(raw)
  return parsed.success ? parsed.data : 'pending'
}

function buildAdminRunItem(
  row: Readonly<{
    id: string
    automationName: string
    status: string | null
    triggerData: unknown
    startedAt: Date | string | null
    completedAt: Date | string | null
    durationMs: number | null
    error: string | null
    createdAt: Date | string
  }>,
  triggerType: string
): AutomationRunAdminItem {
  const startedAtIso = toIso(row.startedAt) ?? toIso(row.createdAt) ?? new Date().toISOString()
  return {
    id: row.id,
    automationName: row.automationName,
    status: coerceStatus(row.status),
    triggerType,
    triggerData: (row.triggerData ?? null) as unknown,
    startedAt: startedAtIso,
    completedAt: toIso(row.completedAt),
    durationMs: row.durationMs,
    attempt: 1,
    error: row.error,
    _admin: {
      lastModifiedBy: null,
      deletedAt: null,
    },
  }
}

function resolveTriggerType(app: App, automationName: string): string {
  const def = (app.automations ?? []).find((a) => a.name === automationName)
  return def?.trigger?.type ?? 'webhook'
}


function buildOverviewSeries(
  fromIso: string,
  toIso: string,
  interval: '1h' | '1d',
  rowsByBucket: ReadonlyMap<string, { readonly runs: number; readonly failures: number }>
): readonly AutomationsOverviewSeriesPoint[] {
  const stepMs = interval === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const fromMs = new Date(fromIso).getTime()
  const toMs = new Date(toIso).getTime()
  const firstBucketMs = Math.ceil(fromMs / stepMs) * stepMs
  const lastBucketMs = Math.ceil(toMs / stepMs) * stepMs
  const expectedCount = Math.max(1, Math.round((lastBucketMs - firstBucketMs) / stepMs))
  const points: AutomationsOverviewSeriesPoint[] = []
  for (let i = 0; i < expectedCount; i += 1) {
    const bucketMs = firstBucketMs + i * stepMs
    const timestamp = new Date(bucketMs).toISOString()
    const found = rowsByBucket.get(timestamp)
    points.push({
      timestamp,
      runs: found?.runs ?? 0,
      failures: found?.failures ?? 0,
    })
  }
  return points
}

interface OverviewRow {
  readonly startedAt: Date | string | null
  readonly createdAt: Date | string
  readonly status: string | null
}

function rowTimestampMs(row: OverviewRow): number {
  const startedAt = row.startedAt ?? row.createdAt
  return startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime()
}

function bucketOverviewRows(
  rows: ReadonlyArray<OverviewRow>,
  stepMs: number
): Map<string, { runs: number; failures: number }> {
  const bucketMap = new Map<string, { runs: number; failures: number }>()
  for (const row of rows) {
    const bucketMs = Math.ceil(rowTimestampMs(row) / stepMs) * stepMs
    const key = new Date(bucketMs).toISOString()
    const entry = bucketMap.get(key) ?? { runs: 0, failures: 0 }
    entry.runs += 1
    if (row.status === 'failed') entry.failures += 1
    bucketMap.set(key, entry)
  }
  return bucketMap
}

function tallyRuns(rows: ReadonlyArray<OverviewRow>): { runs: number; failures: number } {
  let runs = 0
  let failures = 0
  for (const row of rows) {
    runs += 1
    if (row.status === 'failed') failures += 1
  }
  return { runs, failures }
}

async function compute24hTotals(
  period: '24h' | '7d' | '30d',
  periodRows: ReadonlyArray<OverviewRow>,
  nowMs: number
): Promise<{ runs: number; failures: number }> {
  const last24hMs = nowMs - 24 * 60 * 60 * 1000
  if (period === '24h') {
    const filtered = periodRows.filter((row) => rowTimestampMs(row) >= last24hMs)
    return tallyRuns(filtered)
  }
  const last24hRows = (await db
    .select({ status: automationRuns.status })
    .from(automationRuns)
    .where(gte(automationRuns.createdAt, new Date(last24hMs)))) as ReadonlyArray<{
    status: string | null
  }>
  let failures = 0
  for (const r of last24hRows) {
    if (r.status === 'failed') failures += 1
  }
  return { runs: last24hRows.length, failures }
}

async function handleAutomationsOverview(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedQuery = automationsOverviewQuerySchema.safeParse({
    period: c.req.query('period'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const period = parsedQuery.data.period ?? '24h'
  const window = resolvePeriodWindow(period)

  const fromDate = new Date(window.from)
  const rows = (await db
    .select({
      startedAt: automationRuns.startedAt,
      createdAt: automationRuns.createdAt,
      status: automationRuns.status,
    })
    .from(automationRuns)
    .where(gte(automationRuns.createdAt, fromDate))) as ReadonlyArray<OverviewRow>

  const stepMs = window.interval === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const bucketMap = bucketOverviewRows(rows, stepMs)
  const points = buildOverviewSeries(window.from, window.to, window.interval, bucketMap)

  const { runs: runs24h, failures: failures24h } = await compute24hTotals(period, rows, Date.now())

  const { runs: periodRuns, failures: periodFailures } = tallyRuns(rows)
  const successRate =
    periodRuns === 0 ? 1 : Math.max(0, Math.min(1, (periodRuns - periodFailures) / periodRuns))

  const body: AutomationsOverviewResponse = {
    totals: {
      automations: (app.automations ?? []).length,
      runs_24h: runs24h,
      failures_24h: failures24h,
      success_rate: successRate,
    },
    series: {
      interval: window.interval,
      points: [...points],
    },
  }

  const parsed = automationsOverviewResponseSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[admin] automations overview response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build automations overview', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_OVERVIEW_QUERIED,
    actor,
    resourceId: app.name,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}


function encodeRunsCursor(startedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ startedAt, id }), 'utf8').toString('base64')
}

function decodeRunsCursor(
  cursor: string
): { readonly startedAt: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly startedAt?: unknown
      readonly id?: unknown
    }
    if (typeof decoded.startedAt !== 'string' || typeof decoded.id !== 'string') return null
    return { startedAt: decoded.startedAt, id: decoded.id }
  } catch {
    return null
  }
}

function buildListConditions(query: {
  readonly status?: RunStatus | undefined
  readonly automationName?: string | undefined
  readonly automationId?: string | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly cursor?: string | undefined
}): ReadonlyArray<SQL> {
  const conditions: SQL[] = []
  if (query.status) conditions.push(eq(automationRuns.status, query.status))
  if (query.automationName) conditions.push(eq(automationDefinitions.name, query.automationName))
  if (query.automationId) conditions.push(eq(automationRuns.automationId, query.automationId))
  if (query.from) conditions.push(gte(automationRuns.createdAt, new Date(query.from)))
  if (query.to) conditions.push(lt(automationRuns.createdAt, new Date(query.to)))
  if (query.cursor) {
    const decoded = decodeRunsCursor(query.cursor)
    if (decoded) conditions.push(lt(automationRuns.createdAt, new Date(decoded.startedAt)))
  }
  return conditions
}

async function handleListRuns(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedQuery = automationsRunsListQuerySchema.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    status: c.req.query('status'),
    automationName: c.req.query('automationName'),
    automationId: c.req.query('automationId'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    include_deleted: c.req.query('include_deleted'),
  })
  if (!parsedQuery.success) {
    return c.json({ success: false, message: 'Invalid query', code: 'BAD_REQUEST' }, 400)
  }
  const query = parsedQuery.data

  if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
    return c.json({ success: false, message: 'from > to', code: 'BAD_REQUEST' }, 400)
  }

  const conditions = buildListConditions(query)
  const whereClause = conditions.length === 0 ? undefined : and(...conditions)
  const baseQuery = db
    .select({
      id: automationRuns.id,
      automationName: automationDefinitions.name,
      status: automationRuns.status,
      triggerData: automationRuns.triggerData,
      startedAt: automationRuns.startedAt,
      completedAt: automationRuns.completedAt,
      durationMs: automationRuns.durationMs,
      error: automationRuns.error,
      createdAt: automationRuns.createdAt,
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const filtered = whereClause === undefined ? baseQuery : baseQuery.where(whereClause)
  const rows = (await filtered
    .orderBy(desc(automationRuns.createdAt))
    .limit(query.limit + 1)) as ReadonlyArray<{
    id: string
    automationName: string
    status: string | null
    triggerData: unknown
    startedAt: Date | string | null
    completedAt: Date | string | null
    durationMs: number | null
    error: string | null
    createdAt: Date | string
  }>

  const pageRows = rows.slice(0, query.limit)
  const items = pageRows.map((row) => {
    const triggerType = resolveTriggerType(app, row.automationName)
    return buildAdminRunItem(row, triggerType)
  })

  const lastRow = pageRows[pageRows.length - 1]
  const nextCursor =
    rows.length > query.limit && lastRow !== undefined
      ? encodeRunsCursor(toIso(lastRow.createdAt) ?? new Date().toISOString(), lastRow.id)
      : null

  const body = { items, nextCursor }
  const parsed = automationsRunsListResponseSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[admin] automations runs list response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build runs list', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_RUNS_LIST_QUERIED,
    actor,
    resourceId: app.name,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}


async function handleRunDetail(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!

  const parsedParams = automationsRunsDetailParamsSchema.safeParse({
    runId: c.req.param('runId'),
  })
  if (!parsedParams.success) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }
  const { runId } = parsedParams.data

  const rows = (await db
    .select({
      id: automationRuns.id,
      automationName: automationDefinitions.name,
      status: automationRuns.status,
      triggerData: automationRuns.triggerData,
      startedAt: automationRuns.startedAt,
      completedAt: automationRuns.completedAt,
      durationMs: automationRuns.durationMs,
      error: automationRuns.error,
      createdAt: automationRuns.createdAt,
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(eq(automationRuns.id, runId))
    .limit(1)) as ReadonlyArray<{
    id: string
    automationName: string
    status: string | null
    triggerData: unknown
    startedAt: Date | string | null
    completedAt: Date | string | null
    durationMs: number | null
    error: string | null
    createdAt: Date | string
  }>

  const row = rows[0]
  if (!row) {
    return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
  }

  const triggerType = resolveTriggerType(app, row.automationName)
  const item = buildAdminRunItem(row, triggerType)
  const parsed = automationsRunsDetailResponseSchema.safeParse(item)
  if (!parsed.success) {
    console.error('[admin] automations run detail response validation failed', parsed.error)
    return c.json(
      { success: false, message: 'Failed to build run detail', code: 'INTERNAL_ERROR' },
      500
    )
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AUTOMATION_RUNS_DETAIL_QUERIED,
    actor,
    resourceId: runId,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}


export function chainAdminAutomationsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/admin/automations/overview', (c) => handleAutomationsOverview(c, resolveApp()))
    .get('/api/admin/automations/runs/:runId', (c) => handleRunDetail(c, resolveApp()))
    .get('/api/admin/automations/runs', (c) => handleListRuns(c, resolveApp())) as T
}

export type { AutomationRunAdminItem }

