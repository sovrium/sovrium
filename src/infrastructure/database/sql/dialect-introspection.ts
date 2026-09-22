/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { executeRaw, type RawSqlRunner } from './dialect-execute'
import { sqliteSystemTableName } from './dialect-sql'

/**
 * Dialect-aware schema introspection for the dynamic records/forms CRUD layer.
 *
 * Why this helper exists
 * ----------------------
 * The CRUD layer repeatedly asks the database "does column X exist on table Y"
 * and "list the columns of table Y" — for soft-delete detection, authorship
 * columns, array-column typing, required-field validation, etc.
 *
 * On PostgreSQL those questions are answered by querying `information_schema`.
 * SQLite has no `information_schema`; the equivalent is the `pragma_table_info`
 * table-valued function (and `sqlite_master` for object listings).
 *
 * This module centralizes the per-dialect branch so every CRUD introspection
 * callsite goes through one portable surface and never hand-writes a
 * dialect-specific catalog query.
 *
 * Normalized column shape
 * -----------------------
 * Both dialects are mapped onto {@link IntrospectedColumn}: a column name plus
 * the raw driver-reported type string and a nullability flag. The Postgres arm
 * preserves the historical `data_type` / `is_nullable` values verbatim; the
 * SQLite arm derives them from `pragma_table_info`'s `type` and `notnull`
 * columns.
 */

/** A single column as reported by dialect-aware introspection. */
export interface IntrospectedColumn {
  /** Column name. */
  readonly name: string
  /**
   * Raw driver-reported type string.
   * - PostgreSQL: `information_schema.columns.data_type` (e.g. `text`, `ARRAY`).
   * - SQLite: `pragma_table_info.type` (e.g. `TEXT`, `INTEGER`).
   */
  readonly dataType: string
  /** Whether the column accepts NULL. */
  readonly isNullable: boolean
  /**
   * Raw driver-reported column default, or `null` when none.
   * - PostgreSQL: `information_schema.columns.column_default`.
   * - SQLite: `pragma_table_info.dflt_value`.
   */
  readonly columnDefault: string | null
}

/** PostgreSQL `information_schema.columns` projection used here. */
interface PgColumnRow {
  readonly column_name: string
  readonly data_type: string
  readonly is_nullable: string
  readonly column_default: string | null
}

/** SQLite `pragma_table_info` projection used here. */
interface SqlitePragmaRow {
  readonly name: string
  readonly type: string
  readonly notnull: number
  readonly dflt_value: string | null
}

/**
 * List every column of `tableName` with its name, type, and nullability.
 *
 * The table name is bound as a query parameter on both dialects — SQLite's
 * `pragma_table_info(?)` accepts a bind, and Postgres binds it into the
 * `information_schema` predicate — so this is injection-safe even without a
 * pre-validated identifier.
 *
 * @param runner - the `db` facade or a `tx` transaction handle
 * @param tableName - the table to introspect
 * @returns one {@link IntrospectedColumn} per column (empty if the table is unknown)
 */
export const listTableColumns = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string
): Promise<ReadonlyArray<IntrospectedColumn>> => {
  const { dialect } = parseDatabaseDialectConfig()

  if (dialect === 'postgres') {
    const rows = (await executeRaw(
      runner,
      sql`SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = ${tableName}
            AND table_schema = 'public'`
    )) as unknown as ReadonlyArray<PgColumnRow>
    return rows.map((row) => ({
      name: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === 'YES',
      columnDefault: row.column_default,
    }))
  }

  // SQLite — pragma_table_info is a table-valued function; bind the table name.
  const rows = (await executeRaw(
    runner,
    sql`SELECT name, type, "notnull", dflt_value FROM pragma_table_info(${tableName})`
  )) as unknown as ReadonlyArray<SqlitePragmaRow>
  return rows.map((row) => ({
    name: row.name,
    dataType: row.type,
    isNullable: row.notnull === 0,
    columnDefault: row.dflt_value,
  }))
}

/**
 * Resolve which of `columnNames` exist on `tableName`.
 *
 * Replaces the dialect-specific `SELECT column_name FROM information_schema.columns
 * WHERE … AND column_name IN (…)` probes scattered across the CRUD layer.
 *
 * @returns the subset of `columnNames` that exist, as a `Set`
 */
export const getExistingColumnNames = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string,
  columnNames: ReadonlyArray<string>
): Promise<ReadonlySet<string>> => {
  if (columnNames.length === 0) return new Set()
  const wanted = new Set(columnNames)
  const columns = await listTableColumns(runner, tableName)
  return new Set(columns.map((c) => c.name).filter((name) => wanted.has(name)))
}

/**
 * Whether the `system`-namespaced table `name` exists in the database.
 *
 * Some `system` tables are **config-gated**: `user_access` is only materialized
 * when `auth.scopeTables` is declared, `comment_read_state` only when a table
 * opts into `comments.readTracking` (`ensureConditionalSystemTables`). Code that
 * must touch one of those tables unconditionally — the GDPR erasure sweep, which
 * runs inside a single transaction for every app — needs to ask first: a
 * `DELETE FROM` against a table that was never created aborts the transaction and
 * takes the whole erasure down with it.
 *
 * `listTableColumns` cannot answer this: its Postgres arm is pinned to
 * `table_schema = 'public'`, where no `system` table lives.
 *
 * @param runner - the `db` facade or a `tx` transaction handle
 * @param name - the bare system table name (`user_access`, …)
 * @returns `true` if the table exists
 */
export const systemTableExists = async (
  runner: Readonly<RawSqlRunner>,
  name: string
): Promise<boolean> => {
  const { dialect } = parseDatabaseDialectConfig()

  const rows =
    dialect === 'postgres'
      ? await executeRaw(
          runner,
          sql`SELECT 1 AS present FROM information_schema.tables
              WHERE table_schema = 'system' AND table_name = ${name} LIMIT 1`
        )
      : await executeRaw(
          runner,
          sql`SELECT 1 AS present FROM sqlite_master
              WHERE type = 'table' AND name = ${sqliteSystemTableName(name)} LIMIT 1`
        )

  return (rows as unknown as readonly unknown[]).length > 0
}

/**
 * Whether `columnName` exists on `tableName`.
 *
 * @returns `true` if the column exists
 */
export const columnExists = async (
  runner: Readonly<RawSqlRunner>,
  tableName: string,
  columnName: string
): Promise<boolean> =>
  (await getExistingColumnNames(runner, tableName, [columnName])).has(columnName)
