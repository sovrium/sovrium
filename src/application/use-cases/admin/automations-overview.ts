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
  type AdminAutomationStatusRow,
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
  type AutomationsOverviewResponse,
  type AutomationsOverviewSeriesPoint,
  type AutomationsRunsDetailWithStepsResponse,
  type AutomationsRunsListResponse,
} from '@/domain/models/api/admin/automations'
import {
  resolvePeriodWindow,
  type PeriodPreset,
  type PeriodWindow,
} from '@/domain/models/api/admin/envelope/period-preset'
import { type RunStatus } from '@/domain/models/api/automations'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { entityLabelFor } from '@/domain/models/app/auth/readable-name-service'
import { routineRunSources } from '@/domain/models/app/automations/routine-run-service'
import { onDevTimeline } from '@/infrastructure/process/server-boot-instant'
import { buildAdminRunItem, runFailureAttribution, toIso } from './automations-run-item'
import { runsResultFacts, tallyRunCounts } from './automations-run-labels'
import { failedStepOf, readStepLogs, stepTimingOf } from './automations-run-step-facts'
import { encodeRunsCursor, runsListFilters } from './automations-runs-query'
import type { ConsoleLanguage } from './operator-language'
import type { App } from '@/domain/models/app'

// ─── Overview series helpers ────────────────────────────────────────────────────

/** Normalize a run's `startedAt ?? createdAt` timestamp to epoch-ms. */
function rowTimestampMs(row: AdminAutomationOverviewRow): number {
  return coerceTimestampToMs(row.startedAt ?? row.createdAt)
}

/** A bucket's counts: the runs about something, the routine ones, and the failures. */
interface RunTally {
  readonly runs: number
  readonly routineRuns: number
  readonly failures: number
}

const EMPTY_TALLY: RunTally = { runs: 0, routineRuns: 0, failures: 0 }

/** Add one run to a tally: a routine run counts apart, a failure is never routine. */
function tallyRun(acc: RunTally, row: AdminAutomationStatusRow): RunTally {
  return {
    runs: acc.runs + (row.routine ? 0 : 1),
    routineRuns: acc.routineRuns + (row.routine ? 1 : 0),
    failures: acc.failures + (row.status === 'failed' ? 1 : 0),
  }
}

/**
 * Bucket the period-scoped overview rows into the dense
 * `{ runs, routineRuns, failures }` response series via the shared
 * time-series helpers.
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
    initial: EMPTY_TALLY,
    accumulate: tallyRun,
  })
  return buildDenseBucketGrid({
    fromIso: window.from,
    toIso: window.to,
    stepMs,
    rowsByBucket: bucketMap,
    emptyValue: EMPTY_TALLY,
  })
}

/** Tally a flat row list: the 24h tiles. */
function tallyRuns(rows: ReadonlyArray<AdminAutomationStatusRow>): RunTally {
  return rows.reduce(tallyRun, EMPTY_TALLY)
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

    // The windows end at the development timeline's now: the runs counted here
    // are stamped on it, so a pinned host counts the runs it made (the real
    // clock itself everywhere else).
    const now = onDevTimeline()
    const window = resolvePeriodWindow(period, now)
    const fromDate = new Date(window.from)
    const nowMs = now.getTime()

    // Period-scoped raw rows → series + period success rate. Routine runs are
    // judged against the configuration as it is now.
    const routine = routineRunSources(app.automations)
    const rows = yield* repo.listOverviewRowsSince(fromDate, routine)
    const points = buildAutomationsSeries(window, rows)

    // 24h fixed totals — independent of the requested period. When the period
    // is already '24h' we can derive them from the in-memory rows; otherwise we
    // issue a second status-only scan scoped to the last-24h window.
    const last24hMs = nowMs - DAY_MS
    const totals24h =
      period === '24h'
        ? tallyRuns(rows.filter((row) => rowTimestampMs(row) >= last24hMs))
        : tallyRuns(yield* repo.listOverviewStatusesSince(new Date(last24hMs), routine))

    // Period-scoped success rate over EVERY run, routine ones included.
    // Convention: zero runs → 1 (100% healthy).
    const periodTally = tallyRuns(rows)
    const periodRuns = periodTally.runs + periodTally.routineRuns
    const periodFailures = periodTally.failures
    const successRate =
      periodRuns === 0 ? 1 : Math.max(0, Math.min(1, (periodRuns - periodFailures) / periodRuns))

    const body = {
      totals: {
        automations: (app.automations ?? []).length,
        runs_24h: totals24h.runs,
        routine_runs_24h: totals24h.routineRuns,
        failures_24h: totals24h.failures,
        success_rate: successRate,
      },
      series: {
        interval: window.interval,
        points: [...points],
      },
      // The same buckets at the top level: a page chart binds rows by one flat key.
      points: [...points],
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
  /** Only the runs started by hand from a schedule (`true`), or only the others (`false`). */
  readonly onDemand?: boolean | undefined
  /** Whether routine runs are listed (`true`), or left out (`false`, the default). */
  readonly routine: boolean
  /** Free-text term over the automation name and failure `error`; `undefined` = no search. */
  readonly q?: string | undefined
  readonly cursor?: string | undefined
  /** A numbered page (1-based), read when no `cursor` is: the runs past `(page - 1) * limit`. */
  readonly page?: number | undefined
  readonly limit: number
}

/** The runs-list build: `Ok` carries the body; `ValidationFailed` maps to a 500. */
export type AdminRunsListOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: AutomationsRunsListResponse
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

    const filters = runsListFilters(app, input)
    const rows = yield* repo.listAdminRuns(filters)
    const counts = tallyRunCounts(yield* repo.countAdminRunsByStatus(filters))

    const pageRows = rows.slice(0, input.limit)
    // How far each run got: ONE grouped count over the page's step rows.
    const steps = yield* repo.countStepsByRunIds(pageRows.map((row) => row.id))
    const items = pageRows.map((row) =>
      buildAdminRunItem(app, row, steps.get(row.id) ?? 0, language)
    )

    // A numbered page is not a continuation: it carries no cursor.
    const nextCursor =
      filters.offset === undefined ? deriveRunsNextCursor(rows.length, pageRows, input.limit) : null

    // `appliedQuery` rides EVERY response, `null` when no term was applied. Its
    // PRESENCE — not its truthiness — is what tells the grid this endpoint
    // filters server-side and that it must not re-filter the page in memory.
    // Omitting the key on a no-term request would silently re-arm that
    // in-memory pass the moment an operator CLEARS the box.
    const appliedQuery = input.q ?? null
    const body = {
      items,
      nextCursor,
      appliedQuery,
      appliedRoutine: input.routine,
      ...runsResultFacts(counts, language),
    }
    const parsed = decodeSafe(automationsRunsListResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { ...parsed.data, appliedQuery } } as const
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
 * What a person reads for a step: the `label` it declares, else its name made
 * readable. A step the automation no longer declares reads its stored name made
 * readable too.
 */
function stepLabels(app: App, automationName: string): (name: string) => string {
  const def = (app.automations ?? []).find((a) => a.name === automationName)
  return (name) => entityLabelFor(def?.actions.find((a) => a.name === name) ?? { name })
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
    const stepLabel = stepLabels(app, row.automationName)
    const steps = stepRows
      .map((stepRow) => ({ ...buildAdminRunStep(stepRow), ...stepTimingOf(stepRow) }))
      .map((step) => ({ ...step, label: stepLabel(step.name) }))

    const ran = steps.filter((step) => step.status !== 'skipped').length
    const item = buildAdminRunItem(app, row, ran, language)
    const body = {
      ...item,
      steps,
      failedStep: failedStepOf(app, row.automationName, row.status, steps),
      ...(yield* runFailureAttribution(runId, row.status)),
    }
    const parsed = decodeSafe(automationsRunsDetailWithStepsResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  }).pipe(Effect.withSpan('admin.build-admin-run-detail'))
