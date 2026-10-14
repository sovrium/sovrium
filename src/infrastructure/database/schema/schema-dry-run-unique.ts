/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The uniqueness half of an existing table's dry-run plan.
 *
 * The column ALTERs are only part of what the apply path does to an existing
 * table: the live-rows unique index a field gains (the index sync, on both
 * engines) and the duplicate pre-flight that refuses it both happen
 * after, or before, them. A plan reporting only the ALTERs showed no unique
 * constraint at all, and exited 0 over an edit the apply would refuse.
 */

import { Effect } from 'effect'
import { planUniqueChanges, uniquePlanLines } from '../table-operations/unique-constraint-drift'
import type { TableChange } from './schema-dry-run'
import type { TransactionLike } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'

/**
 * `change` with a line per field becoming unique and the duplicate refusals the
 * apply would raise. A table with nothing becoming unique is returned as is.
 */
export const withUniquePlan = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  /** The relation that holds the rows today. */
  readonly source: string
  readonly existingColumns: ReadonlyMap<string, unknown>
  readonly change: TableChange
}): Effect.Effect<TableChange, never> => {
  const { tx, table, source, existingColumns, change } = params
  return planUniqueChanges({ tx, table, source, existingColumns }).pipe(
    Effect.map((plan): TableChange => {
      if (plan.columns.length === 0) return change
      const lines = uniquePlanLines({
        physicalTableName: change.relation ?? table.name,
        columns: plan.columns,
      })
      return {
        ...change,
        kind: change.kind === 'unchanged' ? 'alter' : change.kind,
        statements: change.unsimulated ? change.statements : [...change.statements, ...lines],
        refusals: [...change.refusals, ...plan.refusals],
      }
    }),
    // effect-swallow: a catalog read or probe that cannot run means "no refusal is PROVEN", not that one was found. This is a dry-run REPORT, so it keeps the column plan rather than failing it; the apply path runs the same probe before any DDL and is where a refusal is enforced.
    Effect.orElseSucceed(() => change)
  )
}
