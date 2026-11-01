/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The reading half of the automation-run repository: a run row as the port
 * shapes it, and the filtered, paginated run list (by automation, status,
 * trigger name and reader scope), with the run filters the admin history adds:
 * started by hand, and routine.
 */

import { and, desc, eq, inArray, isNull, notInArray, or, sql, type SQL } from 'drizzle-orm'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import {
  ROUTINE_RUN_STATUSES,
  type RoutineRunSource,
} from '@/domain/models/app/automations/routine-run-service'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDefinitions as automationDefinitionsPg,
  automationRuns as automationRunsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDefinitions as automationDefinitionsSqlite,
  automationRuns as automationRunsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import type {
  ListRunsOptions,
  PersistedRun,
  RunReaderScope,
} from '@/application/ports/repositories/automations/automation-run-repository'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect } from '@/infrastructure/database/drizzle/layer'

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
  startedAsGuest: runRow.startedAsGuest,
  triggerName: runRow.triggerName ?? null,
  relay: runRow.relay,
  valuesErasedAt: toIso(runRow.valuesErasedAt),
  resumeAt: toIso(runRow.resumeAt),
  filesLedger: runRow.filesLedger ?? null,
  ...(runRow.defectClass !== null && runRow.defectSignature !== null
    ? {
        defect: {
          errorClass: runRow.defectClass,
          signature: runRow.defectSignature,
          ...(runRow.defectFrames === null ? {} : { frames: runRow.defectFrames }),
        },
      }
    : {}),
})

/**
 * A run whose relay names no parent run: not one a call or a failure handler
 * started. A run another run started is not its chain starter's to read as such.
 */
const relayNamesNoRun = (dialect: Dialect): SQL =>
  dialect.kind === 'sqlite'
    ? sql`json_extract(${automationRuns.relay}, '$.run') IS NULL`
    : sql`(${automationRuns.relay} ->> 'run') IS NULL`

/** Leave out the runs of the automations named: those only an admin reads. */
const exceptAutomationsFilter = (names: readonly string[]): ReadonlyArray<SQL> =>
  names.length === 0 ? [] : [notInArray(automationDefinitions.name, [...names])]

/**
 * The runs a scoped caller may read: those they started by hand themselves
 * (never one another run started on their behalf), and the runs a request
 * names them an approver of. In the WHERE clause, so a count over the same
 * filters counts only these.
 */
export const readableByFilters = (
  readableBy: RunReaderScope | undefined,
  dialect: Dialect
): ReadonlyArray<SQL> =>
  readableBy === undefined
    ? []
    : [
        or(
          and(
            eq(automationRuns.startedByHand, true),
            eq(automationRuns.triggeredByUserId, readableBy.userId),
            relayNamesNoRun(dialect)
          ),
          ...(readableBy.runIds.length === 0
            ? []
            : [inArray(automationRuns.id, [...readableBy.runIds])])
        ) as SQL,
        ...exceptAutomationsFilter(readableBy.exceptAutomations ?? []),
      ]

/** The runs one trigger entry started — and, when asked, the runs that recorded no name. */
export const triggerNameFilter = (filter: ListRunsOptions['triggerName']): ReadonlyArray<SQL> => {
  if (filter === undefined) return []
  const named = eq(automationRuns.triggerName, filter.name)
  return [filter.orUnrecorded ? (or(named, isNull(automationRuns.triggerName)) as SQL) : named]
}

/** Build the SQL filter list for {@link listAllRuns}. */
const buildListFilters = (options: ListRunsOptions, dialect: Dialect): ReadonlyArray<SQL> => {
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
    ...readableByFilters(options.readableBy, dialect),
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
  db: PortableDb,
  dialect: Dialect,
  options: ListRunsOptions
): Promise<{ readonly runs: ReadonlyArray<PersistedRun>; readonly total: number }> => {
  const filters = buildListFilters(options, dialect)
  const whereClause = filters.length === 0 ? undefined : and(...filters)

  // Count first (matching the filters), then page.
  const countQuery = db
    .select({ value: dialect.sql.castToInt(sql`COUNT(*)`) })
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

/**
 * Whether the run's own trigger data says an operator started it by hand
 * (`invokedOnDemand: true`) — what `?onDemand=` filters on, and what keeps a
 * run from being routine. The JSON boolean is read by its JSON type on SQLite (where `json_extract`
 * answers `1`) and by its text on PostgreSQL; `COALESCE` makes a run whose
 * trigger data holds no such key one of the others, never neither.
 */
const startedByHand = (dialect: Dialect): SQL =>
  dialect.kind === 'sqlite'
    ? sql`COALESCE(json_type(${automationRuns.triggerData}, '$.invokedOnDemand') = 'true', 0) = 1`
    : sql`COALESCE((${automationRuns.triggerData} ->> 'invokedOnDemand') = 'true', false)`

/** The `?onDemand=` predicate: started by hand (`true`), or not (`false`). */
export const onDemandCondition = (
  onDemand: boolean | undefined,
  dialect: Dialect
): ReadonlyArray<SQL> => {
  if (onDemand === undefined) return []
  const byHand = startedByHand(dialect)
  // `sql` rather than drizzle's `not()`, typed `SQL | undefined` since 1.0.0-rc.5.
  return [onDemand ? byHand : sql`not (${byHand})`]
}

/** The runs one routine source starts: its automation, narrowed to its entries. */
const fromRoutineSource = (source: RoutineRunSource): SQL | undefined => {
  const ofAutomation = eq(automationDefinitions.name, source.automationName)
  if (source.triggerNames === undefined) return ofAutomation
  const named =
    source.triggerNames.length === 0
      ? undefined
      : inArray(automationRuns.triggerName, [...source.triggerNames])
  const unrecorded = source.orUnrecorded ? isNull(automationRuns.triggerName) : undefined
  const entries = or(named, unrecorded)
  return entries === undefined ? undefined : and(ofAutomation, entries)
}

/**
 * `1` for a routine run, `0` for any other, on both engines: started by one of
 * the routine `sources`, in a routine status, and not by hand. A `CASE` rather
 * than a bare predicate so a NULL anywhere (an unrecorded trigger name, a
 * status not yet written) reads as "not routine" — never as an unknown that
 * drops the row from either side of a filter.
 */
export const routineFlag = (sources: ReadonlyArray<RoutineRunSource>, dialect: Dialect): SQL => {
  const started = or(...sources.map(fromRoutineSource))
  if (started === undefined) return sql`0`
  const predicate = and(
    started,
    inArray(sql`COALESCE(${automationRuns.status}, 'pending')`, [...ROUTINE_RUN_STATUSES]),
    sql`not (${startedByHand(dialect)})`
  )
  return sql`(CASE WHEN ${predicate} THEN 1 ELSE 0 END)`
}

/** The `?routine=` filter: absent sources list every run, else the routine ones are left out. */
export const routineCondition = (
  sources: ReadonlyArray<RoutineRunSource> | undefined,
  dialect: Dialect
): ReadonlyArray<SQL> =>
  sources === undefined || sources.length === 0 ? [] : [sql`${routineFlag(sources, dialect)} = 0`]
