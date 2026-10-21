/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { planSqliteDrops } from '../table-operations/sqlite-column-drop'
import {
  planHandMadeReplay,
  readHandMadeObjects,
  skippedObjectLine,
} from '../table-operations/sqlite-hand-made-objects'
import type { TableChange } from './schema-dry-run'
import type { ColumnDrop } from '../schema-migration/column-detection'
import type { TransactionLike } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'

/**
 * `change` reported as the rebuild the apply path would run when one of its
 * `DROP COLUMN` statements is one SQLite refuses — a `user` or `relationship`
 * field, a unique or indexed one — instead of the ALTER it would not run. The
 * same decision as the apply path's, read from the same catalog. Any other
 * change, and every PostgreSQL plan, is returned as is.
 */
export const withSqliteDropRebuild = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  /** The relation that holds the rows today. */
  readonly source: string
  /** The `DROP COLUMN` statements among the change's, each with its column. */
  readonly drops: readonly ColumnDrop[]
  readonly change: TableChange
}): Effect.Effect<TableChange, never> => {
  const { tx, table, source, drops, change } = params
  if (change.kind !== 'alter') return Effect.succeed(change)
  return planSqliteDrops({
    tx,
    table,
    alterStatements: change.statements,
    drops,
    source,
  }).pipe(
    Effect.map(({ rebuild }): TableChange =>
      rebuild ? { ...change, kind: 'recreate', statements: [], unsimulated: true } : change
    ),
    // The rebuild drops these columns: name the hand-made objects it cannot put back.
    Effect.flatMap((planned) =>
      withLostHandMadeObjects({ tx, table, source, drops, change: planned })
    ),
    // effect-swallow: a catalog read that cannot run means "no rebuild is PROVEN", not that one is needed. This is a dry-run REPORT, so it keeps the ALTER plan rather than failing it; the apply path reads the same catalog before its first statement and is where the rebuild is decided.
    Effect.orElseSucceed(() => change)
  )
}

/**
 * `change` with the hand-made indexes and triggers a SQLite rebuild would not
 * recreate — the ones naming a dropped column — listed in `lostObjects`. The
 * same catalog read and the same split as the rebuild's own. The removed
 * columns are the `DROP COLUMN`s the plan carries; a rebuild decided for
 * another reason removes none. Any other change, and every PostgreSQL plan, is
 * returned as is.
 */
export const withLostHandMadeObjects = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  /** The relation that holds the rows today. */
  readonly source: string
  readonly drops: readonly ColumnDrop[]
  readonly change: TableChange
}): Effect.Effect<TableChange, never> => {
  const { tx, table, source, drops, change } = params
  if (!isSqliteRuntime() || change.kind !== 'recreate' || drops.length === 0) {
    return Effect.succeed(change)
  }
  return readHandMadeObjects(tx, table, source).pipe(
    Effect.map((objects): TableChange => {
      const { skipped } = planHandMadeReplay(
        objects,
        drops.map((drop) => drop.column)
      )
      return skipped.length === 0
        ? change
        : { ...change, lostObjects: skipped.map(skippedObjectLine) }
    }),
    // effect-swallow: a catalog read that cannot run means "no loss is PROVEN". This is a dry-run REPORT, so it keeps the plan without the list rather than failing it; the rebuild reads the same catalog and logs what it skips.
    Effect.orElseSucceed(() => change)
  )
}
