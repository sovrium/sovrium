/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  not,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminAutomationsDatabaseError,
  AdminAutomationsRepository,
  type AdminAutomationOverviewRow,
  type AdminAutomationRunRow,
  type AdminRunsListFilters,
  type AutomationStepRef,
  type StepLatestRun,
} from '@/application/ports/repositories/automations/admin-automations-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDefinitions as automationDefinitionsPg,
  automationRunSteps as automationRunStepsPg,
  automationRuns as automationRunsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationRunSteps as automationRunStepsSqlite,
  automationRuns as automationRunsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { searchAnyColumn } from '@/infrastructure/database/sql/dialect-sql-helpers'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { triggerNameFilter } from './automation-run-list-repository-live'

// Dialect-aware schema resolution for `automation_runs` / `automation_definitions`
// — moved verbatim from the former presentation/api/routes/admin/automations.ts.
// The PG variant generates `system.<table>` qualifiers; the SQLite variant maps
// flat `system_*` names. Resolved once at module-init (the helper memoizes).
const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)
const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)
const automationRunSteps = resolveDialectSchema(automationRunStepsPg, automationRunStepsSqlite)

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
 * The `?onDemand=` predicate: the run's own trigger data says an operator
 * started it by hand (`invokedOnDemand: true`), or — for `false` — it does not.
 * The JSON boolean is read by its JSON type on SQLite (where `json_extract`
 * answers `1`) and by its text on PostgreSQL; `COALESCE` makes a run whose
 * trigger data holds no such key one of the others, never neither.
 */
const onDemandCondition = (onDemand: boolean | undefined): ReadonlyArray<SQL> => {
  if (onDemand === undefined) return []
  const byHand = isSqliteRuntime()
    ? sql`COALESCE(json_type(${automationRuns.triggerData}, '$.invokedOnDemand') = 'true', 0) = 1`
    : sql`COALESCE((${automationRuns.triggerData} ->> 'invokedOnDemand') = 'true', false)`
  return [onDemand ? byHand : not(byHand)]
}

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
/**
 * A window bound on when a run STARTED, as `from` and `to` are published: its
 * `startedAt`, or — for a run still queued, which has not started — the moment
 * it was created, so a waiting run stays in the period it was asked in.
 */
const startedOn = (compare: typeof gte, bound: Date): SQL =>
  or(
    and(isNotNull(automationRuns.startedAt), compare(automationRuns.startedAt, bound)),
    and(isNull(automationRuns.startedAt), compare(automationRuns.createdAt, bound))
  ) ?? sql`false`

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
    filters.from !== undefined ? [startedOn(gte, filters.from)] : []
  const toFilter: ReadonlyArray<SQL> = filters.to !== undefined ? [startedOn(lt, filters.to)] : []
  const cursorFilter: ReadonlyArray<SQL> =
    filters.cursorBefore !== undefined ? [lt(automationRuns.createdAt, filters.cursorBefore)] : []
  return [
    ...statusFilter,
    ...nameFilter,
    ...triggerNameFilter(filters.triggerName),
    ...idFilter,
    ...fromFilter,
    ...toFilter,
    ...buildSearchConditions(filters),
    ...onDemandCondition(filters.onDemand),
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
      triggerName: automationRuns.triggerName,
      triggerData: automationRuns.triggerData,
      startedAt: automationRuns.startedAt,
      completedAt: automationRuns.completedAt,
      durationMs: automationRuns.durationMs,
      error: automationRuns.error,
      createdAt: automationRuns.createdAt,
      valuesErasedAt: automationRuns.valuesErasedAt,
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const filtered = whereClause === undefined ? baseQuery : baseQuery.where(whereClause)
  return (await filtered
    .orderBy(desc(automationRuns.createdAt), desc(automationRuns.id))
    .limit(filters.limit + 1)
    .offset(filters.offset ?? 0)) as ReadonlyArray<AdminAutomationRunRow>
}

/** The matching runs per stored status, every filter applied but the page window. */
const countAdminRunsByStatusImpl = async (
  filters: AdminRunsListFilters
): Promise<ReadonlyMap<string, number>> => {
  const conditions = buildListConditions({ ...filters, cursorBefore: undefined })
  const baseQuery = db
    .select({ status: automationRuns.status, runs: count() })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const filtered = conditions.length === 0 ? baseQuery : baseQuery.where(and(...conditions))
  const rows = await filtered.groupBy(automationRuns.status)
  return new Map(rows.map((row) => [row.status ?? 'pending', toFiniteCount(row.runs)] as const))
}

/**
 * The newest ran run of each of `steps` (runs ⋈ definitions ⋈ steps), by its
 * start then its id, in ONE read: every ran row of those steps is ranked within
 * its (automation, step) by `row_number()` — a window both engines evaluate —
 * and only each step's first row comes back.
 */
const findLatestRunPerStepImpl = async (
  steps: readonly AutomationStepRef[]
): Promise<readonly StepLatestRun[]> => {
  const which = or(
    ...steps.map((step) =>
      and(
        eq(automationDefinitions.name, step.automationName),
        eq(automationRunSteps.actionName, step.stepName)
      )
    )
  )
  const ranked = db
    .select({
      automationName: automationDefinitions.name,
      stepName: automationRunSteps.actionName,
      id: automationRunSteps.id,
      startedAt: automationRunSteps.startedAt,
      status: automationRunSteps.status,
      error: automationRunSteps.error,
      stepRank:
        sql<number>`row_number() over (partition by ${automationDefinitions.name}, ${automationRunSteps.actionName} order by ${automationRunSteps.startedAt} desc, ${automationRunSteps.id} desc)`.as(
          'step_rank'
        ),
    })
    .from(automationRunSteps)
    .innerJoin(automationRuns, eq(automationRuns.id, automationRunSteps.runId))
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
    .where(and(which, ne(automationRunSteps.status, 'skipped')))
    .as('ranked_step_runs')
  const rows = await db
    .select({
      automationName: ranked.automationName,
      stepName: ranked.stepName,
      id: ranked.id,
      startedAt: ranked.startedAt,
      status: ranked.status,
      error: ranked.error,
    })
    .from(ranked)
    .where(eq(ranked.stepRank, 1))
  return rows as readonly StepLatestRun[]
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

  countAdminRunsByStatus: (filters) => wrap(async () => countAdminRunsByStatusImpl(filters)),

  findAdminRunById: (runId) =>
    wrap(async () => {
      const rows = (await db
        .select({
          id: automationRuns.id,
          automationName: automationDefinitions.name,
          status: automationRuns.status,
          triggerName: automationRuns.triggerName,
          triggerData: automationRuns.triggerData,
          startedAt: automationRuns.startedAt,
          completedAt: automationRuns.completedAt,
          durationMs: automationRuns.durationMs,
          error: automationRuns.error,
          createdAt: automationRuns.createdAt,
          valuesErasedAt: automationRuns.valuesErasedAt,
        })
        .from(automationRuns)
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(eq(automationRuns.id, runId))
        .limit(1)) as ReadonlyArray<AdminAutomationRunRow>
      return rows[0]
    }),

  findLatestRunPerStep: (steps) =>
    steps.length === 0
      ? wrap(async (): Promise<readonly StepLatestRun[]> => [])
      : wrap(async () => findLatestRunPerStepImpl(steps)),

  countStepsByRunIds: (runIds) =>
    runIds.length === 0
      ? wrap(async () => new Map<string, number>())
      : wrap(async () => {
          const rows = await db
            .select({ runId: automationRunSteps.runId, steps: count() })
            .from(automationRunSteps)
            .where(
              and(
                inArray(automationRunSteps.runId, [...runIds]),
                ne(automationRunSteps.status, 'skipped')
              )
            )
            .groupBy(automationRunSteps.runId)
          return new Map(rows.map((row) => [row.runId, toFiniteCount(row.steps)] as const))
        }),
})
