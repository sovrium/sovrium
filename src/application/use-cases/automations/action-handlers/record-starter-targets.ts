/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a record write that names its rows with a filter resolves them for a run
 * someone started by hand: as that person's own `record/list` would.
 *
 * A filter naming a column the starter may not read is refused before any row
 * is resolved, with the refusal a read they may not make gets, so neither a
 * count nor an id can vary with a value hidden from them. A filter on columns
 * they may read is resolved with their row-level read rule ANDed on, and only
 * the rows that rule admits are targeted: a matching row hidden from them is
 * neither written nor refused, and the step answers as if it did not match.
 *
 * A run nobody started keeps resolving its filter over the whole table as the
 * system (`resolveActionTargetIds`), and an explicit id — or an `id equals`
 * filter — still goes straight to the caller write gate, whose refusal of a
 * hidden row is the records API's own.
 */

import { Effect } from 'effect'
import { logError } from '@/infrastructure/logging/logger'
import { runReadAccess, type RunReadAccess } from './record-caller-gate'
import { declaredFilterFields, extractIdFromFilter, toQueryFilter } from './record-filter-shape'
import {
  filterFieldRefusal,
  resolveActionTargetIds,
  rowIdsOf,
  type ActionTargets,
} from './record-filters'
import { listableFields, listForRun, READ_REFUSAL, scopedListFilter } from './record-read-scope'
import type { AutomationContext } from './shared'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type {
  TableReadError,
  TableRepository,
} from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

type StarterRequirements = AuthRepository | DataSourceRepository | TableRepository

/** A run read as its starter: their scope on the table. */
type ScopedAccess = Extract<RunReadAccess, { readonly kind: 'scoped' }>

/** The rows a starter's filter reaches, or the refusal of a filter they may not make. */
export type StarterTargets =
  { readonly refused: true } | { readonly refused: false; readonly ids: readonly string[] }

const REFUSED: StarterTargets = { refused: true }
const NO_TARGET: StarterTargets = { refused: false, ids: [] }

/**
 * The rows `filter` targets for a starter whose scope on `tableName` is
 * `access`. A filter that compiles to no condition targets nothing; the
 * delete's own guard has refused it before this runs. A failed lookup
 * propagates: each caller prices it.
 */
export const starterTargetIds = (input: {
  readonly app: App
  readonly automation: AutomationContext
  readonly tableName: string
  readonly filter: unknown
  readonly access: ScopedAccess
}): Effect.Effect<StarterTargets, TableReadError, StarterRequirements> =>
  Effect.gen(function* () {
    const { app, automation, tableName, access } = input
    const queryFilter = toQueryFilter(input.filter, declaredFilterFields(app, tableName).table)
    if (queryFilter === undefined) return NO_TARGET
    const readable = listableFields(app, tableName, access)
    if (filterFieldRefusal(tableName, queryFilter, readable) !== undefined) return REFUSED
    const filter = scopedListFilter(queryFilter, access)
    if (filter === 'nothing') return NO_TARGET
    const rows = yield* listForRun({
      ...{ app, tableName, access, automation, filter },
      ...{ sort: undefined, limit: undefined, offset: undefined },
    })
    const admitted = rows.filter((row) => access.scope.admits(row))
    return { refused: false, ids: rowIdsOf(admitted) } as const
  }).pipe(
    Effect.withSpan('automations.starter-target-ids', {
      attributes: { 'table.name': input.tableName },
    })
  )

/**
 * The row ids a record write's `filter` targets for the run, or the outcome
 * refusing it — {@link resolveActionTargetIds} with a hand-started run's filter
 * resolved as its starter's list resolves it. A lookup that fails reads as
 * "matched nothing", the lenient policy the single-row operators keep.
 */
export const resolveRunTargetIds = (input: {
  /** The operator name used in a refusal message, e.g. `record.delete`. */
  readonly operator: string
  readonly app: App
  readonly automation: AutomationContext
  readonly tableName: string
  readonly filter: unknown
  /** An explicit id that pre-empts the filter. */
  readonly idFastPath?: string | undefined
}): Effect.Effect<ActionTargets, never, StarterRequirements> =>
  Effect.gen(function* () {
    const { app, automation, tableName, filter, idFastPath } = input
    const system = resolveActionTargetIds({
      ...{ operator: input.operator, tableName, filter, idFastPath },
      declared: declaredFilterFields(app, tableName),
    })
    const explicit = idFastPath !== undefined && idFastPath !== ''
    if (explicit || extractIdFromFilter(filter) !== undefined) return yield* system
    const access = yield* runReadAccess(app, automation, tableName)
    if (access.kind === 'system') return yield* system
    if (access.kind === 'refused') return { resolved: false, outcome: READ_REFUSAL } as const
    const targets = yield* starterTargetIds({ app, automation, tableName, filter, access }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[automations] run filter not resolved', cause))
      ),
      // effect-swallow: the lenient policy of `resolveIdsByFilterLenient` — a
      // lookup that failed reads as "matched nothing", after its cause is logged.
      Effect.catchTag('DatabaseError', () => Effect.succeed(NO_TARGET)),
      Effect.result
    )
    // A filter operator no compiler knows is refused, never read as "matched nothing".
    if (targets._tag === 'Failure') {
      return {
        resolved: false,
        outcome: {
          status: 'failure',
          error: `${input.operator} could not resolve its filter: ${targets.failure.message}`,
        },
      } as const
    }
    return targets.success.refused
      ? ({ resolved: false, outcome: READ_REFUSAL } as const)
      : ({ resolved: true, ids: targets.success.ids } as const)
  }).pipe(Effect.withSpan('automations.resolve-run-target-ids'))
