/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reading half of the automation-run repository: a run row as the port
 * shapes it, and the filtered, paginated run list (by automation, status,
 * trigger name and reader scope).
 */

import { and, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
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
import { castToInt } from '@/infrastructure/database/table-queries/query-helpers/aggregation-helpers'
import type {
  ListRunsOptions,
  PersistedRun,
  RunReaderScope,
} from '@/application/ports/repositories/automations/automation-run-repository'

const automationDefinitions = resolveDialectSchema(
  automationDefinitionsPg,
  automationDefinitionsSqlite
)
const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)

/** A nullable Date as ISO 8601 (or null): the run timestamps are present-or-null, never absent. */
export const toIso = (value: Readonly<Date> | null | undefined): string | null =>
  value instanceof Date ? value.toISOString() : null

/**
 * Map a raw Drizzle row to the public `PersistedRun` shape, joining the
 * definition name. Pre-joined inputs avoid N+1 lookups.
 */
export const toRun = (
  runRow: Readonly<typeof automationRuns.$inferSelect>,
  definitionName: string
): PersistedRun => ({
  id: runRow.id,
  automationId: runRow.automationId,
  automationName: definitionName,
  status: runRow.status,
  triggerData: runRow.triggerData,
  startedAt: toIso(runRow.startedAt),
  completedAt: toIso(runRow.completedAt),
  durationMs: runRow.durationMs,
  error: runRow.error,
  triggeredByUserId: runRow.triggeredByUserId,
  startedByHand: runRow.startedByHand,
  triggerName: runRow.triggerName ?? null,
  relay: runRow.relay,
  valuesErasedAt: toIso(runRow.valuesErasedAt),
  resumeAt: toIso(runRow.resumeAt),
})

/**
 * The runs a scoped caller may read: those they started by hand, and the runs
 * a request names them an approver of. In the WHERE clause, so a count over
 * the same filters counts only these.
 */
export const readableByFilters = (readableBy: RunReaderScope | undefined): ReadonlyArray<SQL> =>
  readableBy === undefined
    ? []
    : [
        or(
          and(
            eq(automationRuns.startedByHand, true),
            eq(automationRuns.triggeredByUserId, readableBy.userId)
          ),
          ...(readableBy.runIds.length === 0
            ? []
            : [inArray(automationRuns.id, [...readableBy.runIds])])
        ) as SQL,
      ]

/** The runs one trigger entry started — and, when asked, the runs that recorded no name. */
export const triggerNameFilter = (filter: ListRunsOptions['triggerName']): ReadonlyArray<SQL> => {
  if (filter === undefined) return []
  const named = eq(automationRuns.triggerName, filter.name)
  return [filter.orUnrecorded ? (or(named, isNull(automationRuns.triggerName)) as SQL) : named]
}

/** Build the SQL filter list for {@link listAllRuns}. */
const buildListFilters = (options: ListRunsOptions): ReadonlyArray<SQL> => {
  const nameFilter: ReadonlyArray<SQL> =
    options.automationName !== undefined
      ? [eq(automationDefinitions.name, options.automationName)]
      : []
  const statusFilter: ReadonlyArray<SQL> =
    options.status !== undefined ? [eq(automationRuns.status, options.status)] : []
  return [
    ...nameFilter,
    ...statusFilter,
    ...triggerNameFilter(options.triggerName),
    ...readableByFilters(options.readableBy),
  ]
}

/** `(page, pageSize)` defaults; `pageSize` undefined when the caller did not paginate. */
const resolvePaging = (
  options: ListRunsOptions
): { readonly page: number; readonly pageSize: number | undefined } => {
  const page = options.page !== undefined && options.page >= 1 ? options.page : 1
  const pageSize =
    options.pageSize !== undefined && options.pageSize >= 1 ? options.pageSize : undefined
  return { page, pageSize }
}

/** Drizzle implementation for {@link AutomationRunRepository.listAll}. */
export const listAllRuns = async (
  options: ListRunsOptions
): Promise<{ readonly runs: ReadonlyArray<PersistedRun>; readonly total: number }> => {
  const filters = buildListFilters(options)
  const whereClause = filters.length === 0 ? undefined : and(...filters)

  // Count first (matching the filters), then page.
  const countQuery = db
    .select({ value: castToInt(sql`COUNT(*)`) })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const countRows = await (whereClause === undefined ? countQuery : countQuery.where(whereClause))
  const total = toFiniteCount(countRows[0]?.value)

  const baseQuery = db
    .select({
      run: automationRuns,
      definitionName: automationDefinitions.name,
    })
    .from(automationRuns)
    .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
  const filtered = whereClause === undefined ? baseQuery : baseQuery.where(whereClause)
  const ordered = filtered.orderBy(desc(automationRuns.createdAt))

  const { page, pageSize } = resolvePaging(options)
  const rows =
    pageSize !== undefined
      ? await ordered.limit(pageSize).offset((page - 1) * pageSize)
      : await ordered
  return {
    runs: rows.map((row) => toRun(row.run, row.definitionName)),
    total,
  }
}
