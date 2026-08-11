/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
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
  readonly triggerData: unknown
  readonly startedAt: Date | string | null
  readonly completedAt: Date | string | null
  readonly durationMs: number | null
  readonly error: string | null
  readonly createdAt: Date | string
}

/**
 * Resolved WHERE-clause inputs for the runs-list reader. The use case parses
 * and validates the raw query string (and decodes the opaque cursor) into this
 * shape; the repository turns it into dialect-aware drizzle predicates.
 *
 * - `cursorBefore` — when set, only rows strictly older than this `createdAt`
 *   are returned (the use case decodes the opaque cursor into this date).
 * - `limit` — the page size; the repository fetches `limit + 1` rows so the
 *   use case can compute `hasMore` / `nextCursor`.
 */
export interface AdminRunsListFilters {
  readonly status?: string | undefined
  readonly automationName?: string | undefined
  readonly automationId?: string | undefined
  readonly from?: Date | undefined
  readonly to?: Date | undefined
  readonly cursorBefore?: Date | undefined
  readonly limit: number
}

export class AdminAutomationsRepository extends Context.Tag('AdminAutomationsRepository')<
  AdminAutomationsRepository,
  {
    /**
     * List `{ startedAt, createdAt, status }` for every run created on/after
     * `since`. Backs the period-scoped overview series + success rate.
     */
    readonly listOverviewRowsSince: (
      since: Date
    ) => Effect.Effect<readonly AdminAutomationOverviewRow[], AdminAutomationsDatabaseError>

    /**
     * List `{ status }` for every run created on/after `since`. Backs the
     * fixed-24h totals tile when the requested period is wider than 24h.
     */
    readonly listOverviewStatusesSince: (
      since: Date
    ) => Effect.Effect<readonly { readonly status: string | null }[], AdminAutomationsDatabaseError>

    /**
     * Cursor-paginated runs-list read. Fetches `filters.limit + 1` joined rows
     * (runs ⋈ definitions) ordered by `createdAt DESC`, applying every set
     * filter immutably. The extra row lets the use case derive `hasMore`.
     */
    readonly listAdminRuns: (
      filters: AdminRunsListFilters
    ) => Effect.Effect<readonly AdminAutomationRunRow[], AdminAutomationsDatabaseError>

    /**
     * Single-run lookup by id (runs ⋈ definitions). Returns `undefined` when no
     * row matches — the route maps that to an anti-enum 404.
     */
    readonly findAdminRunById: (
      runId: string
    ) => Effect.Effect<AdminAutomationRunRow | undefined, AdminAutomationsDatabaseError>
  }
>() {}
