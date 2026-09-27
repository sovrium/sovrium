/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which physical tables in the database the CONFIG owns.
 *
 * The config names tables; the engine materialises more relations than it names.
 * A table carrying a `lookup`, `rollup` or `count` field keeps its rows in
 * `<name>_base` behind a `<name>` VIEW, and a many-to-many relationship keeps its
 * links in a junction table `<source>_<related>`. None of those physical names
 * appears in `app.tables`, so a comparison against config names alone classifies
 * every one of them as a leftover — which is how every full migration used to
 * drop, then re-create EMPTY, every view-backed table and every junction table
 * in the app.
 *
 * Pure: the caller reads the live table list and decides what to do with the
 * obsolete set (count its rows, refuse, drop).
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { getBaseTableName, shouldUseView } from '../lookup/lookup-view-generators'
import { SQLITE_FTS_PREFIX } from '../schema/command-search-fts-ddl'
import { isManyToManyRelationship } from '../sql/sql-field-predicates'
import { generateJunctionTableName } from '../sql/sql-junction-tables'
import type { Table } from '@/domain/models/app/tables'

/** The suffix a view-backed table's physical relation carries. */
const BASE_SUFFIX = getBaseTableName('')

/**
 * Every physical table name the config accounts for: each config table, the
 * `<name>_base` of each view-backed one, and each many-to-many junction table in
 * BOTH directions — the engine creates `<source>_<related>`, and the reciprocal
 * side of the same relationship may be the one the config declares.
 */
export const expectedPhysicalTableNames = (tables: readonly Table[]): ReadonlySet<string> =>
  new Set(
    tables.flatMap((table) => {
      const sanitized = sanitizeTableName(table.name)
      const junctions = table.fields
        .filter(isManyToManyRelationship)
        .flatMap((field) => [
          generateJunctionTableName(table.name, field.relatedTable),
          generateJunctionTableName(field.relatedTable, table.name),
        ])
      return [
        table.name,
        sanitized,
        ...(shouldUseView(table) ? [getBaseTableName(sanitized)] : []),
        ...junctions,
      ]
    })
  )

/**
 * Whether `tableName` is the `_base` relation of a table the config declares.
 *
 * Decided on the STRIPPED owner, never on the suffix alone: `<name>_base` is kept
 * whenever `<name>` is a config table, view-backed or not. That covers the
 * view-backed → plain transition (the base table still holds the rows until the
 * topology step renames it back), and it does not protect an unrelated table the
 * author happened to name `archive_base`, whose owner `archive` is not declared.
 */
const isBaseOfConfigTable = (tableName: string, configNames: ReadonlySet<string>): boolean =>
  tableName.endsWith(BASE_SUFFIX) &&
  tableName.length > BASE_SUFFIX.length &&
  configNames.has(tableName.slice(0, -BASE_SUFFIX.length))

/**
 * Split the database's physical tables into those the config owns and those it
 * no longer declares.
 *
 * Order is preserved within each list, so a caller's drop statements follow the
 * catalog's order exactly as before.
 */
export const classifyPhysicalTables = (
  existing: readonly string[],
  tables: readonly Table[]
): { readonly keep: readonly string[]; readonly obsolete: readonly string[] } => {
  const expected = expectedPhysicalTableNames(tables)
  const configNames = new Set(
    tables.flatMap((table) => [table.name, sanitizeTableName(table.name)])
  )
  const owned = (name: string): boolean =>
    expected.has(name) || isBaseOfConfigTable(name, configNames)
  return {
    keep: existing.filter(owned),
    obsolete: existing.filter((name) => !owned(name)),
  }
}

/**
 * Whether `tableName` belongs to the command palette's SQLite search index: the
 * `fts__<relation>` FTS5 virtual table and its shadow tables.
 *
 * Engine-owned and derived — every row is rebuilt from the table it mirrors by
 * `reconcileCommandSearchIndexes` after each migration — so its row count says
 * nothing about data an operator could lose, and a drop of it must never be
 * refused or reported as one. The prefix is imported from
 * `command-search-fts-ddl.ts`, which reserves it — never a copy of the literal.
 * No config table can land in it: `sanitizeTableName` collapses `__` to `_`, so
 * a user table's physical name never starts with `fts__`.
 */
export const isCommandSearchIndexTable = (tableName: string): boolean =>
  tableName.startsWith(SQLITE_FTS_PREFIX)

/** `1 row`, `3 rows` — the count as an operator reads it. */
export const formatRowCount = (rows: number): string => `${rows} ${rows === 1 ? 'row' : 'rows'}`

/**
 * Why a drop of a populated obsolete table is refused, in the words every
 * surface uses — the boot, `sovrium migrate`, `--dry-run` and `--check` all
 * print this sentence, so the operator reads one refusal wherever they meet it.
 */
export const formatPopulatedDropRefusal = (tableName: string, rows: number): string =>
  `Refusing to drop table ${tableName} (${formatRowCount(rows)}): the config no longer ` +
  `declares it, and dropping it would delete its rows. Starting the app never drops a ` +
  `populated table. Keep the table in the config, or read the plan with ` +
  `\`sovrium migrate <config> --dry-run\` and apply it with ` +
  `\`sovrium migrate <config> --allow-destructive\`.`
