/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Step 8 of the migration: create the link table of every many-to-many field
 * (`CREATE TABLE IF NOT EXISTS`), and on PostgreSQL put back the foreign keys a
 * rebuild of either end dropped.
 */

import { Effect } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logDebug } from '@/infrastructure/logging/logger'
import {
  executeSQLStatements,
  type SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { isManyToManyRelationship } from '../sql/sql-field-predicates'
import {
  generateJunctionForeignKeyRestoreSQL,
  generateJunctionTableDDL,
  generateJunctionTableName,
} from '../sql/sql-junction-tables'
import { buildTablePrimaryKeyTypesMap } from '../table-operations'
import type { Table } from '@/domain/models/app/tables'

/** A link table to ensure: its DDL, then (PostgreSQL) the keys a rebuild may have dropped. */
interface JunctionTableSpec {
  readonly name: string
  readonly ddl: string
  readonly restoreKeys: readonly string[]
}

/** Collect junction table specs for many-to-many relationships (functional construction with deduplication) */
export const collectJunctionTableSpecs = (
  sortedTables: readonly Table[],
  tableUsesView: ReadonlyMap<string, boolean>
): ReadonlyMap<string, JunctionTableSpec> => {
  const keyTypes = buildTablePrimaryKeyTypesMap(sortedTables) // key columns typed as their keys
  const junctionSpecs = sortedTables.flatMap((table) => {
    const manyToManyFields = table.fields.filter(isManyToManyRelationship)
    return manyToManyFields.map((field) => {
      const junctionTableName = generateJunctionTableName(table, field)
      const ddl = generateJunctionTableDDL(table, field, tableUsesView, keyTypes)
      // PostgreSQL: a rebuild of either end dropped the link table's keys (CASCADE).
      const restoreKeys = isSqliteRuntime()
        ? []
        : generateJunctionForeignKeyRestoreSQL(table, field, tableUsesView)
      return [junctionTableName, { name: junctionTableName, ddl, restoreKeys }] as const
    })
  })
  return new Map(junctionSpecs) // deduplicated by link table name, first kept
}

/** Create junction tables for many-to-many relationships */
export const createJunctionTables = (
  tx: TransactionLike,
  junctionTableSpecs: ReadonlyMap<string, JunctionTableSpec>
): Effect.Effect<void, SQLExecutionError, never> =>
  Effect.gen(function* () {
    if (junctionTableSpecs.size === 0) return
    logDebug('[schema] creating junction tables', {
      tables: Array.from(junctionTableSpecs.keys()).join(', '),
    })
    // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- all statements execute on the single reserved transaction connection: width cannot exceed one pooled connection regardless of fan-out.
    yield* Effect.forEach(
      Array.from(junctionTableSpecs.values()),
      (spec) => executeSQLStatements(tx, [spec.ddl, ...spec.restoreKeys]),
      { concurrency: 'unbounded' }
    )
  })
