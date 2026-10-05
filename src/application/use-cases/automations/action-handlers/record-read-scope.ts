/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How `record/read` and `record/list` apply the run's read access: a run
 * nobody started reads as the system, a hand-started run reads as its starter —
 * their row-level read rule ANDed onto the query, the rows it admits, and the
 * columns they may read.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { omitHiddenLookups } from '@/application/use-cases/tables/hidden-lookup-omission'
import { lookupReadMasks } from '@/application/use-cases/tables/lookup-read-masks'
import { buildGuestSession } from '../build-guest-session'
import { CALLER_REFUSAL, runLinkReader, type RunReadAccess } from './record-caller-gate'
import { declaredFieldNames } from './record-filters'
import type { ActionOutcome, AutomationContext } from './shared'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

/** The failure a read the run's caller may not make reports — the records API's own answer. */
export const READ_REFUSAL: ActionOutcome = { status: 'failure', error: CALLER_REFUSAL }

/**
 * The list query's filter with the caller's row-level read rule ANDed on, or
 * `'nothing'` when that rule admits no row. A run nobody started keeps its
 * filter as written.
 */
export const scopedListFilter = (
  queryFilter: QueryFilter | undefined,
  access: RunReadAccess
): QueryFilter | undefined | 'nothing' => {
  if (access.kind !== 'scoped' || access.scope.clause === undefined) return queryFilter
  if (access.scope.clause === 'nothing') return 'nothing'
  return { and: [...(queryFilter?.and ?? []), access.scope.clause] }
}

/**
 * A list's rows as a run reads them from the table: the port's list, with
 * every lookup the filter or the sort names evaluated as empty where a
 * hand-started run's starter may not read the linked record — as the records
 * API evaluates it for the same person. Without the mask a filter on a hidden
 * lookup would still pick the rows its value matches (and a sort would still
 * order by it), one answer per run, even though the value itself is left out
 * of the rows handed back. A run nobody started reads everything.
 *
 * `app` reaches the port on purpose: `buildSortClause` orders a
 * `single-select` by its declared options only when it can see them.
 */
export const listForRun = (input: {
  readonly app: App
  readonly tableName: string
  readonly access: RunReadAccess
  readonly automation: AutomationContext
  readonly filter: QueryFilter | undefined
  readonly sort: string | undefined
  readonly limit: number | undefined
  readonly offset: number | undefined
}): Effect.Effect<
  readonly Readonly<Record<string, unknown>>[],
  DatabaseError,
  AuthRepository | TableRepository | DataSourceRepository
> =>
  Effect.gen(function* () {
    const { app, tableName, access, filter, sort } = input
    const reader = access.kind === 'scoped' ? yield* runLinkReader(input.automation) : undefined
    const lookupMasks = yield* lookupReadMasks(app, tableName, reader, { filter, sort })
    const repo = yield* TableRepository
    return yield* repo.listRecords({
      session: buildGuestSession(),
      tableName,
      app,
      filter,
      lookupMasks,
      sort,
      limit: input.limit,
      offset: input.offset,
    })
  }).pipe(
    Effect.withSpan('automations.list-for-run', { attributes: { 'table.name': input.tableName } })
  )

/**
 * The rows a read hands the run: for a hand-started run, the rows and columns
 * its starter may read, with every `lookup` through a link to a row the
 * starter may not read left out, exactly as the records API leaves it out for
 * them. A run nobody started reads everything.
 */
export const readableRows = (input: {
  readonly app: App
  readonly tableName: string
  readonly rows: readonly Readonly<Record<string, unknown>>[]
  readonly access: RunReadAccess
  readonly automation: AutomationContext
}): Effect.Effect<
  readonly Readonly<Record<string, unknown>>[],
  DatabaseError,
  AuthRepository | TableRepository | DataSourceRepository
> => {
  const { app, tableName, rows, access, automation } = input
  if (access.kind !== 'scoped') return Effect.succeed(rows)
  const { scope } = access
  // Judged BEFORE the columns are projected: a starter who may not read the
  // relationship column would otherwise keep a lookup whose key is gone.
  return runLinkReader(automation).pipe(
    Effect.flatMap((reader) =>
      omitHiddenLookups(
        app,
        tableName,
        rows.filter((row) => scope.admits(row)),
        reader
      )
    ),
    Effect.map((admitted) => admitted.map((row) => scope.project(row))),
    Effect.withSpan('automations.readable-rows', { attributes: { 'table.name': tableName } })
  )
}

/**
 * The columns a list may filter, sort and select on. For a hand-started run a
 * column its starter may not read is not one of them: filtering on it would
 * disclose its values one answer at a time.
 */
export const listableFields = (
  app: App,
  tableName: string,
  access: RunReadAccess
): ReadonlySet<string> | undefined => {
  const declared = declaredFieldNames(app, tableName)
  if (declared === undefined || access.kind !== 'scoped') return declared
  return new Set([...declared].filter((name) => access.scope.readsColumn(name)))
}
