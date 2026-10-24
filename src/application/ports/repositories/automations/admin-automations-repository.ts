/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { RoutineRunSource } from '@/domain/models/app/automations/routine-run-service'
import type { TriggerNameFilter } from '@/domain/models/app/automations/trigger-entries-service'
import type { Effect } from 'effect'

/**
 * Admin Automations Repository Port
 *
 * Type-safe data access backing the three admin automations endpoints:
 *
 *   - `GET /api/admin/automations/overview`  → {@link listOverviewRowsSince} +
 *     {@link listOverviewStatusesSince} (the period scan + the fixed-24h scan).
 *   - `GET /api/admin/automations/runs`       → {@link listAdminRuns} (cursor
 *     pagination over `automation_runs` joined to `automation_definitions`).
 *   - `GET /api/admin/automations/runs/:runId` → {@link findAdminRunById}.
 *
 * This is a deliberately separate port from {@link AutomationRunRepository}.
 * The latter's `PersistedRun` shape pre-normalizes timestamps to ISO strings
 * and drops `createdAt` — but the admin reads need the *raw* `createdAt`
 * (the cursor + overview-bucketing anchor) and the dialect-native
 * `Date | string` timestamp shape so the use case can fall back
 * `startedAt ?? createdAt` and align buckets. The runs-list pagination model
 * (cursor-by-createdAt + a 5-filter contract) also has no analog in
 * `ListRunsOptions` (name/status + offset paging). Extending the existing port
 * to cover these reads would distort it, so the admin reads get their own port.
 *
 * The row types below are defined here (decoupled from Drizzle) so the
 * application layer stays free of an infrastructure dependency. Implementation
 * lives in the infrastructure layer (admin-automations-repository-live.ts).
 */

/**
 * Database error for admin-automations read operations.
 */
export class AdminAutomationsDatabaseError extends Data.TaggedError(
  'AdminAutomationsDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * Compact row used by the overview rollup: just enough to bucket a run by its
 * interval-aligned timestamp and tag it as a failure. `startedAt` may be null
 * for runs that never reached the scheduler, in which case the use case falls
 * back to `createdAt` (non-null by schema).
 */
export interface AdminAutomationOverviewRow {
  readonly startedAt: Date | string | null
  readonly createdAt: Date | string
  readonly status: string | null
  /** Whether the run is routine, judged against the sources the read was given. */
  readonly routine: boolean
}

/** A run's status, and whether it is routine — what the fixed-24h tiles count. */
export interface AdminAutomationStatusRow {
  readonly status: string | null
  readonly routine: boolean
}

/**
 * Raw joined run row used by the runs-list and detail readers. Mirrors the
 * `automation_runs` ⋈ `automation_definitions` projection — timestamps stay in
 * their dialect-native `Date | string` shape so the use case owns ISO
 * normalization (and the `startedAt ?? createdAt` fallback).
 */
export interface AdminAutomationRunRow {
  readonly id: string
  readonly automationName: string
  readonly status: string | null
  /** The name of the trigger entry that started it; `null` for a run recorded before names. */
  readonly triggerName: string | null
  readonly triggerData: unknown
  readonly startedAt: Date | string | null
  readonly completedAt: Date | string | null
  readonly durationMs: number | null
  readonly error: string | null
  readonly createdAt: Date | string
  /** When the values this run captured were erased with an account; `null` otherwise. */
  readonly valuesErasedAt: Date | string | null
}

/**
 * Resolved WHERE-clause inputs for the runs-list reader. The use case parses
 * and validates the raw query string (and decodes the opaque cursor) into this
 * shape; the repository turns it into dialect-aware drizzle predicates.
 *
 * - `cursorBefore` — when set, only rows strictly older than this `createdAt`
 *   are returned (the use case decodes the opaque cursor into this date).
 * - `q` — the operator's free-text term (see below).
 * - `limit` — the page size; the repository fetches `limit + 1` rows so the
 *   use case can compute `hasMore` / `nextCursor`.
 */
export interface AdminRunsListFilters {
  readonly status?: string | undefined
  readonly automationName?: string | undefined
  /** The runs one trigger entry started (see the domain's `triggerNameFilterOf`). */
  readonly triggerName?: TriggerNameFilter | undefined
  readonly automationId?: string | undefined
  readonly from?: Date | undefined
  readonly to?: Date | undefined
  readonly cursorBefore?: Date | undefined
  /**
   * Free-text term over the automation NAME and the failure `error` text,
   * already trimmed and length-checked by `searchTermSchema`. `undefined` means
   * "no search" — the unfiltered page, never "match nothing".
   *
   * It composes INTO the cursor seek rather than beside it, which is what turns
   * the grid's reach from "matches among the 25 rows it holds" into "matches
   * across the whole history".
   *
   * `status` is deliberately NOT in this haystack: it already has the `status`
   * filter above AND its own combobox on the surface, so folding it in would
   * make a term like `failed` a category match that buries the one run the
   * operator was looking for. `automationName` is the exact-match filter above;
   * this is its substring sibling, and the two coexist because the grid's
   * combobox selects a name while the box searches for one.
   */
  readonly q?: string | undefined
  /** Only the runs started by hand from a schedule (`true`), or only the others (`false`). */
  readonly onDemand?: boolean | undefined
  /**
   * Leave out the routine runs these sources start (see the domain's
   * `routineRunSources`): a run of one of them whose status is routine and that
   * no operator started by hand. `undefined` lists every run.
   */
  readonly hideRoutineOf?: ReadonlyArray<RoutineRunSource> | undefined
  readonly limit: number
  /**
   * Rows to skip before the page — a NUMBERED page (`?page=`), the alternative
   * to {@link cursorBefore}. The two never meet: a page is asked for by one.
   */
  readonly offset?: number | undefined
}

/** One top-level step of one automation, as its run records it. */
export interface AutomationStepRef {
  readonly automationName: string
  readonly stepName: string
}

/** When a recorded step last ran, and how it ended. */
export interface LatestStepRun {
  readonly startedAt: Date | string | null
  readonly status: string
  readonly error: string | null
}

/** The latest run of one step: which step, its step-run id, and the run itself. */
export interface StepLatestRun extends AutomationStepRef, LatestStepRun {
  readonly id: string
}

export class AdminAutomationsRepository extends Context.Service<
  AdminAutomationsRepository,
  {
    /**
     * List `{ startedAt, createdAt, status, routine }` for every run created
     * on/after `since`, `routine` judged against `routine`'s sources. Backs the
     * period-scoped overview series + success rate.
     */
    readonly listOverviewRowsSince: (
      since: Date,
      routine: ReadonlyArray<RoutineRunSource>
    ) => Effect.Effect<readonly AdminAutomationOverviewRow[], AdminAutomationsDatabaseError>

    /**
     * List `{ status, routine }` for every run created on/after `since`. Backs
     * the fixed-24h totals tile when the requested period is wider than 24h.
     */
    readonly listOverviewStatusesSince: (
      since: Date,
      routine: ReadonlyArray<RoutineRunSource>
    ) => Effect.Effect<readonly AdminAutomationStatusRow[], AdminAutomationsDatabaseError>

    /**
     * Cursor-paginated runs-list read. Fetches `filters.limit + 1` joined rows
     * (runs ⋈ definitions) ordered by `createdAt DESC`, applying every set
     * filter immutably. The extra row lets the use case derive `hasMore`.
     */
    readonly listAdminRuns: (
      filters: AdminRunsListFilters
    ) => Effect.Effect<readonly AdminAutomationRunRow[], AdminAutomationsDatabaseError>

    /**
     * How many runs match `filters` — every filter but the page window — per
     * stored status, as ONE grouped count. The sum is the whole result's size,
     * the figure a numbered pager counts its pages from.
     */
    readonly countAdminRunsByStatus: (
      filters: AdminRunsListFilters
    ) => Effect.Effect<ReadonlyMap<string, number>, AdminAutomationsDatabaseError>

    /**
     * Single-run lookup by id (runs ⋈ definitions). Returns `undefined` when no
     * row matches — the route maps that to an anti-enum 404.
     */
    readonly findAdminRunById: (
      runId: string
    ) => Effect.Effect<AdminAutomationRunRow | undefined, AdminAutomationsDatabaseError>

    /**
     * How many steps each of `runIds` ran — its recorded step rows, minus the
     * ones recorded as `skipped`, which never ran — as ONE grouped count: a
     * page of runs costs one query, not one per run. A run with no such row
     * has no entry.
     */
    readonly countStepsByRunIds: (
      runIds: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, number>, AdminAutomationsDatabaseError>

    /**
     * For each of `steps`, its newest recorded run that actually ran (finished
     * or failed, never `skipped`), by when it started, ties by the larger
     * step-run id — as ONE grouped read, so a list of connections costs one
     * query, not one per connection. A step that never ran has no entry.
     */
    readonly findLatestRunPerStep: (
      steps: readonly AutomationStepRef[]
    ) => Effect.Effect<readonly StepLatestRun[], AdminAutomationsDatabaseError>
  }
>()('AdminAutomationsRepository') {}
