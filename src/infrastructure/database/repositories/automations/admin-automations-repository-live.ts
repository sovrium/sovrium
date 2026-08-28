/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminAutomationsDatabaseError,
  AdminAutomationsRepository,
  type AdminAutomationOverviewRow,
  type AdminAutomationRunRow,
  type AdminRunsListFilters,
} from '@/application/ports/repositories/automations/admin-automations-repository'
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
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { searchAnyColumn } from '@/infrastructure/database/sql/dialect-sql-helpers'

// Dialect-aware schema resolution for `automation_runs` / `automation_definitions`
// — moved verbatim from the former presentation/api/routes/admin/automations.ts.
// The PG variant generates `system.<table>` qualifiers; the SQLite variant maps
// flat `system_*` names. Resolved once at module-init (the helper memoizes).
const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)
const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)

/** Wrap a DB promise, adapting failures to AdminAutomationsDatabaseError. */
const wrap = makeDbWrap((cause) => new AdminAutomationsDatabaseError({ cause }))

/**
 * The `?q=` predicate: the term occurs in the automation NAME or the run's
 * failure `error` text.
 *
 * `error` is the reason this search exists at all — it is the one column that
 * answers "which runs blew up on ECONNREFUSED", and the run-history grid renders
 * Automation / Status / Started / Duration, so it appears in NO cell. A
 * client-side filter over the visible cells cannot reach it even on the page it
 * holds, which is why the response must also echo `appliedQuery` (see the
 * use case) so the grid suppresses its own in-memory pass.
 *
 * Deliberately excluded: `status` (it has `?status` AND a combobox — folding it
 * in makes `?q=failed` a category match that buries the wanted row, and the cell
 * is client-localised so a text match would agree only by accident of language),
 * `createdAt` / `startedAt` (bounded by `?from` / `?to` — substring-matching a
 * formatted timestamp is not a search), `triggerData` (an unbounded JSON blob
 * whose text form differs per dialect) and `id` (addressed exactly by the detail
 * endpoint; a substring over a UUID is noise).
 *
 * {@link searchAnyColumn} owns the rest of the contract — the portable
 * `lower(col) LIKE lower(pattern)` spelling, `%` / `_` escaped to literals, and
 * an absent term contributing NO condition so clearing the box restores the
 * whole history rather than emptying it.
 */
const buildSearchConditions = (filters: AdminRunsListFilters): ReadonlyArray<SQL> =>
  searchAnyColumn(filters.q, automationDefinitions.name, automationRuns.error)

/**
 * Build the WHERE-clause condition list for the runs-list read. Spreads each
 * optional filter immutably so the result is a frozen ReadonlyArray<SQL>; the
 * caller wraps with `and(...)` when non-empty.
 *
 * The cursor anchors on `createdAt` (non-null by schema) — `startedAt` may be
 * null for runs that never reached the scheduler, so it cannot anchor a stable
 * sort. The list is sorted `createdAt DESC`, so the cursor predicate selects
 * rows strictly older than the cursor's `createdAt`.
 */
const buildListConditions = (filters: AdminRunsListFilters): ReadonlyArray<SQL> => {
  const statusFilter: ReadonlyArray<SQL> =
    filters.status !== undefined ? [eq(automationRuns.status, filters.status)] : []
  const nameFilter: ReadonlyArray<SQL> =
    filters.automationName !== undefined
      ? [eq(automationDefinitions.name, filters.automationName)]
      : []
  const idFilter: ReadonlyArray<SQL> =
    filters.automationId !== undefined
      ? [eq(automationRuns.automationId, filters.automationId)]
      : []
  const fromFilter: ReadonlyArray<SQL> =
    filters.from !== undefined ? [gte(automationRuns.createdAt, filters.from)] : []
  const toFilter: ReadonlyArray<SQL> =
    filters.to !== undefined ? [lt(automationRuns.createdAt, filters.to)] : []
  const cursorFilter: ReadonlyArray<SQL> =
    filters.cursorBefore !== undefined ? [lt(automationRuns.createdAt, filters.cursorBefore)] : []
  return [
    ...statusFilter,
    ...nameFilter,
    ...idFilter,
    ...fromFilter,
    ...toFilter,
    ...buildSearchConditions(filters),
    ...cursorFilter,
  ]
}

/**
 * Drizzle implementation for {@link AdminAutomationsRepository.listAdminRuns}.
 * Pulled out of the `wrap()` callback so the latter stays under the complexity
 * cap. Fetches `limit + 1` joined rows so the use case can derive `hasMore`.
 */
const listAdminRunsImpl = async (
  filters: AdminRunsListFilters
): Promise<ReadonlyArray<AdminAutomationRunRow>> => {
  const conditions = buildListConditions(filters)
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
  return (await filtered
    .orderBy(desc(automationRuns.createdAt))
    .limit(filters.limit + 1)) as ReadonlyArray<AdminAutomationRunRow>
}

/**
 * Admin Automations Repository Implementation (Drizzle).
 *
 * Three dialect-aware reads over `system.automation_runs` (joined to
 * `automation_definitions` for the runs name) backing the admin overview, list,
 * and detail endpoints. All projection / bucketing / cursor logic lives in the
 * `automations-overview` use case; this layer emits only raw queries.
 */
export const AdminAutomationsRepositoryLive = Layer.succeed(AdminAutomationsRepository, {
  listOverviewRowsSince: (since) =>
    wrap(
      async () =>
        (await db
          .select({
            startedAt: automationRuns.startedAt,
            createdAt: automationRuns.createdAt,
            status: automationRuns.status,
          })
          .from(automationRuns)
          .where(gte(automationRuns.createdAt, since))) as ReadonlyArray<AdminAutomationOverviewRow>
    ),

  listOverviewStatusesSince: (since) =>
    wrap(
      async () =>
        (await db
          .select({ status: automationRuns.status })
          .from(automationRuns)
          .where(gte(automationRuns.createdAt, since))) as ReadonlyArray<{
          status: string | null
        }>
    ),

  listAdminRuns: (filters) => wrap(async () => listAdminRunsImpl(filters)),

  findAdminRunById: (runId) =>
    wrap(async () => {
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
        .limit(1)) as ReadonlyArray<AdminAutomationRunRow>
      return rows[0]
    }),
})
