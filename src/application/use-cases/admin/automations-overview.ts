/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  AdminAutomationsRepository,
  type AdminAutomationOverviewRow,
  type AdminAutomationRunRow,
  type AdminAutomationsDatabaseError,
} from '@/application/ports/repositories/admin-automations-repository'
import {
  resolvePeriodWindow,
  type PeriodPreset,
} from '@/domain/models/api/admin/_shared/period-preset'
import {
  automationsOverviewResponseSchema,
  automationsRunsDetailResponseSchema,
  automationsRunsListResponseSchema,
  type AutomationRunAdminItem,
  type AutomationsOverviewResponse,
  type AutomationsOverviewSeriesPoint,
} from '@/domain/models/api/admin/automations'
import { runStatusSchema, type RunStatus } from '@/domain/models/api/automations'
import { AdminAutomationsRepositoryLive } from '@/infrastructure/database/repositories/admin-automations-repository-live'
import type { App } from '@/domain/models/app'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS


function toIso(value: Readonly<Date> | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function coerceStatus(raw: unknown): RunStatus {
  const parsed = runStatusSchema.safeParse(raw)
  return parsed.success ? parsed.data : 'pending'
}

function resolveTriggerType(app: App, automationName: string): string {
  const def = (app.automations ?? []).find((a) => a.name === automationName)
  return def?.trigger?.type ?? 'webhook'
}

function buildAdminRunItem(
  row: AdminAutomationRunRow,
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


function rowTimestampMs(row: AdminAutomationOverviewRow): number {
  const startedAt = row.startedAt ?? row.createdAt
  return startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt).getTime()
}

function buildOverviewSeries(
  fromIso: string,
  toIso: string,
  interval: '1h' | '1d',
  rowsByBucket: ReadonlyMap<string, { readonly runs: number; readonly failures: number }>
): readonly AutomationsOverviewSeriesPoint[] {
  const stepMs = interval === '1h' ? HOUR_MS : DAY_MS
  const fromMs = new Date(fromIso).getTime()
  const toMs = new Date(toIso).getTime()
  const firstBucketMs = Math.ceil(fromMs / stepMs) * stepMs
  const lastBucketMs = Math.ceil(toMs / stepMs) * stepMs
  const expectedCount = Math.max(1, Math.round((lastBucketMs - firstBucketMs) / stepMs))
  const bucketIndexes: readonly number[] = Array.from({ length: expectedCount }, (_unused, i) => i)
  return bucketIndexes.map((i) => {
    const timestamp = new Date(firstBucketMs + i * stepMs).toISOString()
    const found = rowsByBucket.get(timestamp)
    return {
      timestamp,
      runs: found?.runs ?? 0,
      failures: found?.failures ?? 0,
    }
  })
}

function bucketOverviewRows(
  rows: ReadonlyArray<AdminAutomationOverviewRow>,
  stepMs: number
): ReadonlyMap<string, { readonly runs: number; readonly failures: number }> {
  const counts = rows.reduce<Readonly<Record<string, { runs: number; failures: number }>>>(
    (acc, row) => {
      const bucketMs = Math.ceil(rowTimestampMs(row) / stepMs) * stepMs
      const key = new Date(bucketMs).toISOString()
      const prev = acc[key] ?? { runs: 0, failures: 0 }
      return {
        ...acc,
        [key]: {
          runs: prev.runs + 1,
          failures: prev.failures + (row.status === 'failed' ? 1 : 0),
        },
      }
    },
    {}
  )
  return new Map(Object.entries(counts))
}

function tallyRuns(rows: ReadonlyArray<AdminAutomationOverviewRow>): {
  readonly runs: number
  readonly failures: number
} {
  return rows.reduce(
    (acc, row) => ({
      runs: acc.runs + 1,
      failures: acc.failures + (row.status === 'failed' ? 1 : 0),
    }),
    { runs: 0, failures: 0 }
  )
}

function tallyStatuses(rows: ReadonlyArray<{ readonly status: string | null }>): {
  readonly runs: number
  readonly failures: number
} {
  return rows.reduce(
    (acc, row) => ({
      runs: acc.runs + 1,
      failures: acc.failures + (row.status === 'failed' ? 1 : 0),
    }),
    { runs: 0, failures: 0 }
  )
}


export function encodeRunsCursor(startedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ startedAt, id }), 'utf8').toString('base64')
}

export function decodeRunsCursor(
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


export type AutomationsOverviewOutcome =
  | { readonly _tag: 'Ok'; readonly body: AutomationsOverviewResponse }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export const BuildAutomationsOverview = (
  app: App,
  period: PeriodPreset
): Effect.Effect<
  AutomationsOverviewOutcome,
  AdminAutomationsDatabaseError,
  AdminAutomationsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminAutomationsRepository

    const window = resolvePeriodWindow(period)
    const fromDate = new Date(window.from)
    const nowMs = Date.now()

    const rows = yield* repo.listOverviewRowsSince(fromDate)
    const stepMs = window.interval === '1h' ? HOUR_MS : DAY_MS
    const bucketMap = bucketOverviewRows(rows, stepMs)
    const points = buildOverviewSeries(window.from, window.to, window.interval, bucketMap)

    const last24hMs = nowMs - DAY_MS
    const totals24h =
      period === '24h'
        ? tallyRuns(rows.filter((row) => rowTimestampMs(row) >= last24hMs))
        : tallyStatuses(yield* repo.listOverviewStatusesSince(new Date(last24hMs)))

    const { runs: periodRuns, failures: periodFailures } = tallyRuns(rows)
    const successRate =
      periodRuns === 0 ? 1 : Math.max(0, Math.min(1, (periodRuns - periodFailures) / periodRuns))

    const body = {
      totals: {
        automations: (app.automations ?? []).length,
        runs_24h: totals24h.runs,
        failures_24h: totals24h.failures,
        success_rate: successRate,
      },
      series: {
        interval: window.interval,
        points: [...points],
      },
    } satisfies AutomationsOverviewResponse

    const parsed = automationsOverviewResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  })


export interface AdminRunsListInput {
  readonly status?: RunStatus | undefined
  readonly automationName?: string | undefined
  readonly automationId?: string | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly cursor?: string | undefined
  readonly limit: number
}

export type AdminRunsListOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly items: readonly AutomationRunAdminItem[]
        readonly nextCursor: string | null
      }
    }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export const BuildAdminRunsList = (
  app: App,
  input: AdminRunsListInput
): Effect.Effect<AdminRunsListOutcome, AdminAutomationsDatabaseError, AdminAutomationsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AdminAutomationsRepository

    const decoded = input.cursor ? decodeRunsCursor(input.cursor) : undefined
    const cursorBefore =
      decoded !== undefined && decoded !== null ? new Date(decoded.startedAt) : undefined

    const rows = yield* repo.listAdminRuns({
      status: input.status,
      automationName: input.automationName,
      automationId: input.automationId,
      from: input.from !== undefined ? new Date(input.from) : undefined,
      to: input.to !== undefined ? new Date(input.to) : undefined,
      cursorBefore,
      limit: input.limit,
    })

    const pageRows = rows.slice(0, input.limit)
    const items = pageRows.map((row) =>
      buildAdminRunItem(row, resolveTriggerType(app, row.automationName))
    )

    const lastRow = pageRows[pageRows.length - 1]
    const nextCursor =
      rows.length > input.limit && lastRow !== undefined
        ? encodeRunsCursor(toIso(lastRow.createdAt) ?? new Date().toISOString(), lastRow.id)
        :
          null

    const body = { items, nextCursor }
    const parsed = automationsRunsListResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: { items: parsed.data.items, nextCursor: parsed.data.nextCursor },
    } as const
  })


export type AdminRunDetailOutcome =
  | { readonly _tag: 'Ok'; readonly body: AutomationRunAdminItem }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export const BuildAdminRunDetail = (
  app: App,
  runId: string
): Effect.Effect<
  AdminRunDetailOutcome,
  AdminAutomationsDatabaseError,
  AdminAutomationsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminAutomationsRepository

    const row = yield* repo.findAdminRunById(runId)
    if (row === undefined) {
      return { _tag: 'NotFound' } as const
    }

    const item = buildAdminRunItem(row, resolveTriggerType(app, row.automationName))
    const parsed = automationsRunsDetailResponseSchema.safeParse(item)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  })

export const AdminAutomationsLayer = Layer.mergeAll(AdminAutomationsRepositoryLive)
