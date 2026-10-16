/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the three admin automations endpoints
 * (`GET /api/admin/automations/{overview,runs,runs/:runId}`).
 *
 * The application layer owns ALL pure logic:
 *   - admin run-item building (timestamp ISO coercion + `startedAt ?? createdAt`
 *     fallback, status coercion, trigger-type resolution from the live App, the
 *     `_admin` envelope),
 *   - the dense overview series (every interval bucket present with 0 counts),
 *   - the 24h fixed totals + period success rate,
 *   - the opaque runs cursor encode/decode (byte-identical to the former route
 *     so existing clients' cursors keep working),
 *   - assembling + response-schema-validating each body.
 *
 * Only the raw reads (period scan, 24h status scan, cursor-paginated list,
 * single-run lookup) live in the infrastructure repository, accessed via
 * {@link AdminAutomationsRepository}. The audit emit
 * (`automation.{overview,runs.list,runs.detail}.queried`) is an application-layer
 * async funnel composed by the route after a successful read.
 *
 * Locks [internal ref] D2 (soft-delete default off — `include_deleted` forward-contract),
 * D3 (`_admin` envelope shape), and D5 (`series` rollup with fixed buckets) by
 * consuming the shared `resolvePeriodWindow()` helper rather than re-deriving the
 * bucket grid.
 */

import { Effect } from 'effect'
import {
  AdminAutomationsRepository,
  type AdminAutomationOverviewRow,
  type AdminAutomationRunRow,
  type AdminAutomationsDatabaseError,
} from '@/application/ports/repositories/automations/admin-automations-repository'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { adminNestedSteps } from '@/application/use-cases/automations/run/nested-step-record'
import {
  bucketRowsByTimestamp,
  buildDenseBucketGrid,
  coerceTimestampToMs,
  DAY_MS,
  intervalStepMs,
} from '@/domain/kernel/time/time-series-bucketing'
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
import {
  resolvePeriodWindow,
  type PeriodPreset,
  type PeriodWindow,
} from '@/domain/models/api/admin/envelope/period-preset'
import { stepLogEntrySchema, type RunStatus } from '@/domain/models/api/automations'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { triggerNameFilterOf } from '@/domain/models/app/automations/trigger-entries-service'
import { buildAdminRunItem, toIso } from './automations-run-item'
import { decodeRunsCursor, encodeRunsCursor } from './automations-runs-query'
import type { ConsoleLanguage } from './operator-language'
import type { App } from '@/domain/models/app'

// ─── Overview series helpers ────────────────────────────────────────────────────

/** Normalize a run's `startedAt ?? createdAt` timestamp to epoch-ms. */
function rowTimestampMs(row: AdminAutomationOverviewRow): number {
  return coerceTimestampToMs(row.startedAt ?? row.createdAt)
}

/**
 * Bucket the period-scoped overview rows into the dense `{ runs, failures }`
 * response series via the shared time-series helpers.
 */
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

/** Count runs + failures in a flat row list (used for the success rate). */
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

/** Count failures in a flat `{ status }` list. */
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

// ─── Overview use case ──────────────────────────────────────────────────────────

/**
 * Outcome of the overview build. `Ok` carries the response-schema-validated
 * body; `ValidationFailed` signals the assembled body failed the response gate
 * (the route maps this to a 500 + logs the schema decode error, exactly as before).
 */
export type AutomationsOverviewOutcome =
  | { readonly _tag: 'Ok'; readonly body: AutomationsOverviewResponse }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the automations-overview body for the requested `period`.
 *
 * Reads (via {@link AdminAutomationsRepository}):
 *   - the period-scoped `{ startedAt, createdAt, status }` scan → series +
 *     period success rate,
 *   - the fixed-24h `{ status }` scan (only when period is wider than 24h) →
 *     totals.runs_24h / failures_24h.
 *
 * `totals.automations` is the count of configured automations from the live App
 * (resolved by the route's `resolveApp` thunk so a draft-publish swap is
 * reflected without restart — the live-migration-on-publish design).
 */
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

    // Period-scoped raw rows → series + period success rate.
    const rows = yield* repo.listOverviewRowsSince(fromDate)
    const points = buildAutomationsSeries(window, rows)

    // 24h fixed totals — independent of the requested period. When the period
    // is already '24h' we can derive them from the in-memory rows; otherwise we
    // issue a second status-only scan scoped to the last-24h window.
    const last24hMs = nowMs - DAY_MS
    const totals24h =
      period === '24h'
        ? tallyRuns(rows.filter((row) => rowTimestampMs(row) >= last24hMs))
        : tallyStatuses(yield* repo.listOverviewStatusesSince(new Date(last24hMs)))

    // Period-scoped success rate. Convention: zero runs → 1 (100% healthy).
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

    const parsed = decodeSafe(automationsOverviewResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  }).pipe(Effect.withSpan('admin.build-automations-overview'))

// ─── Runs-list use case ─────────────────────────────────────────────────────────

/**
 * Validated runs-list inputs, parsed by the route from the query string. The
 * cursor is still the opaque string here — the use case decodes it (so the
 * encode/decode pair stays co-located with the rest of the pure logic).
 */
export interface AdminRunsListInput {
  readonly status?: RunStatus | undefined
  readonly automationName?: string | undefined
  /** The name of the trigger that started the run, read as the public history reads it. */
  readonly triggerName?: string | undefined
  readonly automationId?: string | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
  /** Free-text term over the automation name and failure `error`; `undefined` = no search. */
  readonly q?: string | undefined
  readonly cursor?: string | undefined
  readonly limit: number
}

/** The runs-list build: `Ok` carries the body; `ValidationFailed` maps to a 500. */
export type AdminRunsListOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly items: readonly AutomationRunAdminItem[]
        readonly nextCursor: string | null
        readonly appliedQuery: string | null
      }
    }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the cursor-paginated runs-list body.
 *
 * Pagination semantics (preserved verbatim from the former route): fetch
 * `limit + 1` rows ordered `createdAt DESC`; the page is the first `limit`
 * rows; `nextCursor` is non-null only when a `limit + 1`-th row existed.
 *
 * `q` composes INTO that seek rather than beside it, so a page is a page of
 * MATCHES — a run thirty rows down is reachable in one query instead of being
 * unreachable from a grid that only ever holds twenty-five.
 */
/**
 * Derive the opaque `nextCursor` for a runs page: non-null only when the
 * `limit + 1` fetch actually returned that extra row, i.e. when a further page
 * exists. Split out of the use case so the generator stays under its complexity
 * ceiling.
 */
function deriveRunsNextCursor(
  rowCount: number,
  pageRows: ReadonlyArray<AdminAutomationRunRow>,
  limit: number
): string | null {
  const lastRow = pageRows[pageRows.length - 1]
  if (rowCount <= limit || lastRow === undefined) return null
  return encodeRunsCursor(toIso(lastRow.createdAt) ?? new Date().toISOString(), lastRow.id)
}

export const BuildAdminRunsList = (
  app: App,
  input: AdminRunsListInput,
  language: ConsoleLanguage
): Effect.Effect<AdminRunsListOutcome, AdminAutomationsDatabaseError, AdminAutomationsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AdminAutomationsRepository

    // Cursor anchors on createdAt (non-null by schema). The encoded cursor
    // carries the previous page's last `createdAt` under the `startedAt` key
    // (historical field name) — decode it into the `cursorBefore` predicate.
    const decoded = input.cursor ? decodeRunsCursor(input.cursor) : undefined
    const cursorBefore =
      decoded !== undefined && decoded !== null ? new Date(decoded.startedAt) : undefined

    const rows = yield* repo.listAdminRuns({
      status: input.status,
      automationName: input.automationName,
      triggerName:
        input.triggerName === undefined
          ? undefined
          : triggerNameFilterOf(app.automations, input.automationName, input.triggerName),
      automationId: input.automationId,
      from: input.from !== undefined ? new Date(input.from) : undefined,
      to: input.to !== undefined ? new Date(input.to) : undefined,
      q: input.q,
      cursorBefore,
      limit: input.limit,
    })

    const pageRows = rows.slice(0, input.limit)
    // How far each run got: ONE grouped count over the page's step rows.
    const steps = yield* repo.countStepsByRunIds(pageRows.map((row) => row.id))
    const items = pageRows.map((row) =>
      buildAdminRunItem(app, row, steps.get(row.id) ?? 0, language)
    )

    const nextCursor = deriveRunsNextCursor(rows.length, pageRows, input.limit)

    // `appliedQuery` rides EVERY response, `null` when no term was applied. Its
    // PRESENCE — not its truthiness — is what tells the grid this endpoint
    // filters server-side and that it must not re-filter the page in memory.
    // Omitting the key on a no-term request would silently re-arm that
    // in-memory pass the moment an operator CLEARS the box.
    const appliedQuery = input.q ?? null
    const body = { items, nextCursor, appliedQuery }
    const parsed = decodeSafe(automationsRunsListResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: { items: parsed.data.items, nextCursor: parsed.data.nextCursor, appliedQuery },
    } as const
  }).pipe(Effect.withSpan('admin.build-admin-runs-list'))

// ─── Run-detail use case ────────────────────────────────────────────────────────

/**
 * Outcome of the run-detail build. `NotFound` maps to an anti-enum 404 (and the
 * route emits NO audit entry on that path); `ValidationFailed` maps to a 500.
 *
 * The `Ok` body carries the run row + `_admin` envelope PLUS the per-step I/O
 * list (`steps`) so the dashboard's run-detail panel renders the per-step
 * Input/Output panels (the admin dashboard automations runs requirement [internal ref]). The
 * extra `steps` field is additive — clients parsing against the bare
 * `automationsRunsDetailResponseSchema` simply strip it.
 */
export type AdminRunDetailOutcome =
  | { readonly _tag: 'Ok'; readonly body: AutomationsRunsDetailWithStepsResponse }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

const decodeStepLogEntry = decodeSafe(stepLogEntrySchema)

/**
 * Read the persisted `logs` column as the step's log entries. Always an array:
 * an absent or non-array column is a step that logged nothing, and an entry
 * the engine would never write (unknown level, missing message, a bare value)
 * is DROPPED one by one, so one corrupt entry cannot 500 a run.
 */
function readStepLogs(logs: unknown): AdminRunStep['logs'] {
  if (!Array.isArray(logs)) return []
  return logs.flatMap((entry: unknown) => {
    const decoded = decodeStepLogEntry(entry)
    return decoded.success ? [{ level: decoded.data.level, message: decoded.data.message }] : []
  })
}

/**
 * Project a persisted step row to the admin run-step shape: `input` is the
 * action's resolved `props`, absent values read `null`, and a path or loop
 * step carries the steps it ran (`nested-step-record.ts`).
 */
function buildAdminRunStep(step: {
  readonly actionName: string
  readonly stepIndex: number
  readonly status: string
  readonly input: unknown
  readonly output: unknown
  readonly error: string | null
  readonly logs?: unknown
  readonly nested?: unknown
}): AdminRunStep {
  return {
    index: step.stepIndex,
    name: step.actionName,
    status: step.status,
    input: step.input ?? null,
    output: step.output ?? null,
    error: step.error,
    logs: readStepLogs(step.logs),
    ...adminNestedSteps(step.nested),
  }
}

/**
 * Build the single-run detail body for `runId`. Unknown id → `NotFound`
 * (anti-enum 404). The route short-circuits BEFORE the audit emit on that path
 * per the spec contract. The body includes the per-step I/O list, fetched via
 * the {@link AutomationRunRepository} (the persisted `input`/`output` per step).
 */
export const BuildAdminRunDetail = (
  app: App,
  runId: string,
  language: ConsoleLanguage
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

    // Fetch the per-step I/O rows (best-effort: a step read failure degrades to
    // an empty step list rather than failing the whole detail read).
    const runRepo = yield* AutomationRunRepository
    const stepRows = yield* runRepo.findStepsByRunId(runId).pipe(
      // effect-swallow: stated two lines up — the run's own row has already been read and IS the answer; the per-step I/O is detail, and losing it degrades the detail view rather than failing it.
      Effect.orElseSucceed(() => [] as const)
    )
    const steps = stepRows.map(buildAdminRunStep)

    const ran = steps.filter((step) => step.status !== 'skipped').length
    const item = buildAdminRunItem(app, row, ran, language)
    const parsed = decodeSafe(automationsRunsDetailWithStepsResponseSchema)({ ...item, steps })
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  }).pipe(Effect.withSpan('admin.build-admin-run-detail'))
