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
} from '@/application/ports/repositories/automations/admin-automations-repository'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import {
  resolvePeriodWindow,
  type PeriodPreset,
  type PeriodWindow,
} from '@/domain/models/api/admin/_shared/period-preset'
import {
  automationsOverviewResponseSchema,
  automationsRunsDetailWithStepsResponseSchema,
  automationsRunsListResponseSchema,
  type AdminRunStep,
  type AutomationRunAdminItem,
  type AutomationsOverviewResponse,
  type AutomationsOverviewSeriesPoint,
  type AutomationsRunsDetailWithStepsResponse,
} from '@/domain/models/api/admin/automations'
import { runStatusSchema, type RunStatus } from '@/domain/models/api/automations'
import {
  bucketRowsByTimestamp,
  buildDenseBucketGrid,
  coerceTimestampToMs,
  DAY_MS,
  intervalStepMs,
} from '@/domain/utils/time-series-bucketing'
import { AdminAutomationsRepositoryLive } from '@/infrastructure/database/repositories/automations/admin-automations-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-run-repository-live'
import type { App } from '@/domain/models/app'


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
  return coerceTimestampToMs(row.startedAt ?? row.createdAt)
}

function buildAutomationsSeries(
  window: PeriodWindow,
  rows: ReadonlyArray<AdminAutomationOverviewRow>
): readonly AutomationsOverviewSeriesPoint[] {
  const stepMs = intervalStepMs(window.interval)
  const bucketMap = bucketRowsByTimestamp({
    rows,
    getTimestamp: (row) => row.startedAt ?? row.createdAt,
    stepMs,
    initial: { runs: 0, failures: 0 },
    accumulate: (acc, row) => ({
      runs: acc.runs + 1,
      failures: acc.failures + (row.status === 'failed' ? 1 : 0),
    }),
  })
  return buildDenseBucketGrid({
    fromIso: window.from,
    toIso: window.to,
    stepMs,
    rowsByBucket: bucketMap,
    emptyValue: { runs: 0, failures: 0 },
  })
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
    const points = buildAutomationsSeries(window, rows)

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
  | { readonly _tag: 'Ok'; readonly body: AutomationsRunsDetailWithStepsResponse }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

function buildAdminRunStep(step: {
  readonly actionName: string
  readonly status: string
  readonly input: unknown
  readonly output: unknown
  readonly error: string | null
}): AdminRunStep {
  return {
    name: step.actionName,
    status: step.status,
    input: step.input ?? null,
    output: step.output ?? null,
    error: step.error,
  }
}

export const BuildAdminRunDetail = (
  app: App,
  runId: string
): Effect.Effect<
  AdminRunDetailOutcome,
  AdminAutomationsDatabaseError,
  AdminAutomationsRepository | AutomationRunRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminAutomationsRepository

    const row = yield* repo.findAdminRunById(runId)
    if (row === undefined) {
      return { _tag: 'NotFound' } as const
    }

    const runRepo = yield* AutomationRunRepository
    const stepRows = yield* runRepo
      .findStepsByRunId(runId)
      .pipe(Effect.catchAll(() => Effect.succeed([] as const)))
    const steps = stepRows.map(buildAdminRunStep)

    const item = buildAdminRunItem(row, resolveTriggerType(app, row.automationName))
    const parsed = automationsRunsDetailWithStepsResponseSchema.safeParse({ ...item, steps })
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  })

export const AdminAutomationsLayer = Layer.mergeAll(
  AdminAutomationsRepositoryLive,
  AutomationRunRepositoryLive
)
