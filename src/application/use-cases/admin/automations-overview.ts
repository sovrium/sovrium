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

// ─── Shared item helpers ───────────────────────────────────────────────────────

/**
 * Convert a database timestamp (Date or string) to canonical ISO 8601 UTC.
 * Postgres returns `Date`, SQLite returns either Date (when mode: timestamp_ms)
 * or string depending on the driver. We normalize for the response shape.
 */
function toIso(value: Readonly<Date> | string | null | undefined): string | null {
  // eslint-disable-next-line unicorn/no-null -- API contract uses `null` for absent timestamps (matches public run schema); preserved from the former route helper
  if (value === null || value === undefined) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

/**
 * Best-effort coercion of a string-status to the canonical RunStatus enum.
 * The DB stores arbitrary text on `automation_runs.status` (default 'pending');
 * malformed values fall back to 'pending' so the response always validates.
 */
function coerceStatus(raw: unknown): RunStatus {
  const parsed = runStatusSchema.safeParse(raw)
  return parsed.success ? parsed.data : 'pending'
}

/**
 * Resolve the trigger type for a given automation name by looking it up in the
 * live App config. Falls back to 'webhook' (the only Phase-0 trigger shape that
 * produces runs visible from the admin list).
 */
function resolveTriggerType(app: App, automationName: string): string {
  const def = (app.automations ?? []).find((a) => a.name === automationName)
  return def?.trigger?.type ?? 'webhook'
}

/**
 * Build a canonical admin run item from a joined DB row.
 *
 * The public `runSchema` requires every field — including `startedAt`. For runs
 * that never reached the scheduler (rare race in tests where the webhook
 * returned before the engine wrote `started_at`), we fall back to `createdAt` so
 * the schema does not reject the row.
 */
function buildAdminRunItem(
  row: AdminAutomationRunRow,
  triggerType: string
  // eslint-disable-next-line functional/prefer-immutable-types -- AutomationRunAdminItem is the Zod-inferred response shape (upstream-mutable); the route serializes it straight to JSON without mutating
): AutomationRunAdminItem {
  const startedAtIso = toIso(row.startedAt) ?? toIso(row.createdAt) ?? new Date().toISOString()
  return {
    id: row.id,
    automationName: row.automationName,
    status: coerceStatus(row.status),
    triggerType,
    // eslint-disable-next-line unicorn/no-null -- public run schema's triggerData is `.nullable()`; null is the canonical absent value
    triggerData: (row.triggerData ?? null) as unknown,
    startedAt: startedAtIso,
    completedAt: toIso(row.completedAt),
    durationMs: row.durationMs,
    attempt: 1,
    error: row.error,
    _admin: {
      // eslint-disable-next-line unicorn/no-null -- API envelope canonically uses `null` for absent values (matches public schema + audit envelope contract)
      lastModifiedBy: null,
      // eslint-disable-next-line unicorn/no-null -- D2 forward contract: every active row has deletedAt === null until the column lands
      deletedAt: null,
    },
  }
}

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

// ─── Runs cursor (opaque base64 of `{ startedAt, id }`) ─────────────────────────

/** Encode a runs-list cursor — opaque base64 of `{ startedAt, id }`. */
export function encodeRunsCursor(startedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ startedAt, id }), 'utf8').toString('base64')
}

/**
 * Decode a runs-list cursor. Returns `null` (the use case maps that to "ignore
 * the cursor") when the payload is malformed.
 */
export function decodeRunsCursor(
  cursor: string
): { readonly startedAt: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly startedAt?: unknown
      readonly id?: unknown
    }
    // eslint-disable-next-line unicorn/no-null -- null sentinel, see above
    if (typeof decoded.startedAt !== 'string' || typeof decoded.id !== 'string') return null
    return { startedAt: decoded.startedAt, id: decoded.id }
  } catch {
    // eslint-disable-next-line unicorn/no-null -- null sentinel, see above
    return null
  }
}

// ─── Overview use case ──────────────────────────────────────────────────────────

/**
 * Outcome of the overview build. `Ok` carries the response-schema-validated
 * body; `ValidationFailed` signals the assembled body failed the response gate
 * (the route maps this to a 500 + logs the Zod error, exactly as before).
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
 * reflected without restart — [internal ref]).
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

    const parsed = automationsOverviewResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  })

// ─── Runs-list use case ─────────────────────────────────────────────────────────

/**
 * Validated runs-list inputs, parsed by the route from the query string. The
 * cursor is still the opaque string here — the use case decodes it (so the
 * encode/decode pair stays co-located with the rest of the pure logic).
 */
export interface AdminRunsListInput {
  readonly status?: RunStatus | undefined
  readonly automationName?: string | undefined
  readonly automationId?: string | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly cursor?: string | undefined
  readonly limit: number
}

/**
 * Outcome of the runs-list build. `Ok` carries the response body (items +
 * nextCursor); `ValidationFailed` maps to a 500 (response-gate failure).
 */
export type AdminRunsListOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly items: readonly AutomationRunAdminItem[]
        readonly nextCursor: string | null
      }
    }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the cursor-paginated runs-list body.
 *
 * Pagination semantics (preserved verbatim from the former route): fetch
 * `limit + 1` rows ordered `createdAt DESC`; the page is the first `limit`
 * rows; `nextCursor` is non-null only when a `limit + 1`-th row existed.
 */
export const BuildAdminRunsList = (
  app: App,
  input: AdminRunsListInput
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
        : // eslint-disable-next-line unicorn/no-null -- API envelope uses `null` for an absent next page (matches public list schema)
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

// ─── Run-detail use case ────────────────────────────────────────────────────────

/**
 * Outcome of the run-detail build. `NotFound` maps to an anti-enum 404 (and the
 * route emits NO audit entry on that path); `ValidationFailed` maps to a 500.
 *
 * The `Ok` body carries the run row + `_admin` envelope PLUS the per-step I/O
 * list (`steps`) so the dashboard's run-detail panel renders the per-step
 * Input/Output panels ([internal ref] [internal ref]). The
 * extra `steps` field is additive — clients parsing against the bare
 * `automationsRunsDetailResponseSchema` simply strip it.
 */
export type AdminRunDetailOutcome =
  | { readonly _tag: 'Ok'; readonly body: AutomationsRunsDetailWithStepsResponse }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Project a persisted step row to the admin run-step shape (the per-step I/O the
 * dashboard run-detail panel renders). `input` is the action's `props`; `output`
 * is the step's output payload — both already persisted in the run model
 * (`run-persistence.ts:108-109`). `null`-coalesces absent values to match the
 * schema's `.nullable()` declarations.
 */
function buildAdminRunStep(step: {
  readonly actionName: string
  readonly status: string
  readonly input: unknown
  readonly output: unknown
  readonly error: string | null
  // eslint-disable-next-line functional/prefer-immutable-types -- AdminRunStep is the Zod-inferred shape (upstream-mutable); serialized straight to JSON
}): AdminRunStep {
  return {
    name: step.actionName,
    status: step.status,
    // eslint-disable-next-line unicorn/no-null -- schema declares input/output `.nullable()`; null is the canonical absent value
    input: step.input ?? null,
    // eslint-disable-next-line unicorn/no-null -- schema declares input/output `.nullable()`
    output: step.output ?? null,
    error: step.error,
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

    // Fetch the per-step I/O rows (best-effort: a step read failure degrades to
    // an empty step list rather than failing the whole detail read).
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

/**
 * Application layer for the admin-automations use cases. Merges the admin
 * read repository (overview / list / detail row reads) with the automation-run
 * repository (per-step I/O reads for the run-detail panel).
 */
export const AdminAutomationsLayer = Layer.mergeAll(
  AdminAutomationsRepositoryLive,
  AutomationRunRepositoryLive
)
