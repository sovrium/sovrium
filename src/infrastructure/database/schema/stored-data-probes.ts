/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The checks the checksum fast path makes before it skips the migration: that
 * the stored objects and values are the ones this binary writes. The checksum
 * hashes the config alone, so a repair shipped in a binary would otherwise
 * never reach a deployment whose config did not move.
 */

import { getPhysicalTableName } from '@/infrastructure/database/lookup/lookup-view-generators'
import { logDebug, logWarning } from '@/infrastructure/logging/logger'
import { isManyToManyRelationship } from '../sql/sql-field-predicates'
import { generateJunctionTableName, postgresStoredName } from '../sql/sql-junction-tables'
import { storedConstraintsCurrent } from '../table-operations/live-unique-shape'
import { sqliteLegacyDateValuesQuery } from '../table-operations/sqlite-date-normalisation'
import { columnTypesCurrent } from './column-type-drift'
import type { TransactionLike } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'

/** What the probes read through: the fast path's read-only connection. */
export interface StoredDataProbe {
  readonly isSqlite: boolean
  readonly tableExistsSql: (name: string) => string
  /** The first installed view whose definition is not the generated one (see `view-definition-drift.ts`). */
  readonly staleViewDefinition: (tables: readonly Table[]) => Promise<string | undefined>
  /** Table name → column name → the `data_type` the catalog reports. Empty on SQLite. */
  readonly liveColumnTypes: () => Promise<ReadonlyMap<string, ReadonlyMap<string, string>>>
  readonly tx: TransactionLike
}

/**
 * Whether the stored objects and values are the ones THIS binary writes: the
 * checksum hashes the config alone, so a repair shipped in a binary — a view's
 * SQL, a formula column's type, a SQLite date's stored form — would otherwise
 * never reach a deployment whose config did not move.
 */
export const storedDataCurrent = async (
  quick: Readonly<StoredDataProbe>,
  tables: readonly Table[]
): Promise<boolean> => {
  const current =
    (await linkTablesPresent(quick, tables)) &&
    (await viewDefinitionsCurrent(quick, tables)) &&
    (await columnTypesCurrent(quick.liveColumnTypes, tables)) &&
    (await sqliteDateValuesStored(quick, tables)) &&
    (await storedConstraintsCurrent(quick.tx, quick.isSqlite, tables))
  if (current) {
    logDebug('[schema] checksum matches and tables verified — skipping migration (fast path)')
  }
  return current
}

/**
 * Whether every many-to-many field's own link table exists. A binary that gives
 * two fields to one table a link table each finds them missing on a database an
 * earlier one left with a shared table, and the full migration splits it
 * (`link-table-splits.ts`) — the config, and so the checksum, need not move.
 */
const linkTablesPresent = async (
  quick: Readonly<StoredDataProbe>,
  tables: readonly Table[]
): Promise<boolean> => {
  const names = tables.flatMap((table) =>
    table.fields
      .filter(isManyToManyRelationship)
      .map((f) => generateJunctionTableName(table, f))
      // The catalog lists the 63 characters PostgreSQL keeps of a longer name.
      .map((name) => (quick.isSqlite ? name : postgresStoredName(name)))
  )
  const missing = await names.reduce<Promise<string | undefined>>(async (found, name) => {
    const earlier = await found
    if (earlier !== undefined) return earlier
    const rows = (await quick.tx.unsafe(quick.tableExistsSql(name))) as readonly {
      exists: unknown
    }[]
    return rows[0]?.exists ? undefined : name
  }, Promise.resolve(undefined))
  if (missing === undefined) return true
  logDebug('[schema] checksum matches but a link table is missing — full migration', {
    table: missing,
  })
  return false
}

/**
 * Whether no SQLite table still holds a datetime or time written before the
 * write path stored them in one form. The rewrite runs in the full migration
 * (`normaliseSqliteDateValues`); without this check a deployment that upgrades
 * without editing its config would take the fast path and keep its old text.
 * Each query stops at the first legacy row; a clean column is one scan.
 */
const sqliteDateValuesStored = async (
  quick: Readonly<StoredDataProbe>,
  tables: readonly Table[]
): Promise<boolean> => {
  if (!quick.isSqlite) return true
  const probes = tables.flatMap((table) => {
    const query = sqliteLegacyDateValuesQuery(getPhysicalTableName(table), table)
    return query === undefined ? [] : [{ table: table.name, query }]
  })
  const legacy = await probes.reduce<Promise<string | undefined>>(async (found, probe) => {
    const earlier = await found
    if (earlier !== undefined) return earlier
    const rows = (await quick.tx.unsafe(probe.query)) as readonly { exists: number | boolean }[]
    return rows[0]?.exists ? probe.table : undefined
  }, Promise.resolve(undefined))
  if (legacy === undefined) return true
  logDebug(
    '[schema] checksum matches but a table holds a datetime or time in its pre-upgrade form — full migration',
    { table: legacy }
  )
  return false
}

/**
 * Whether every installed view is the one THIS binary generates: the checksum
 * hashes the config alone, so an upgrade that changes a view's SQL would
 * otherwise never reach a deployment whose config stayed put.
 */
const viewDefinitionsCurrent = async (
  quick: Readonly<StoredDataProbe>,
  tables: readonly Table[]
): Promise<boolean> => {
  const outcome = await quick.staleViewDefinition(tables).then(
    (view) => ({ compared: true as const, view }),
    (error: unknown) => ({ compared: false as const, error })
  )
  if (!outcome.compared) {
    // The PostgreSQL comparison needs a TEMPORARY view, which a role without
    // the `TEMP` privilege on the database cannot create. Not being able to
    // compare must not stop the boot: it declines the fast path (the full
    // migration is idempotent and rebuilds every view), and says why, because
    // it costs every boot until the privilege is granted.
    logWarning(
      '[schema] could not compare the installed views with this version (does the database role have the TEMP privilege?) — full migration',
      { reason: outcome.error instanceof Error ? outcome.error.message : String(outcome.error) }
    )
    return false
  }
  if (outcome.view !== undefined) {
    logDebug(
      '[schema] checksum matches but a view is not the one this version writes — full migration',
      { view: outcome.view }
    )
    return false
  }
  return true
}
