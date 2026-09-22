/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { isViewComputedFormula } from '../formula/formula-utils'
import { shouldUseView, getBaseTableName } from '../lookup/lookup-view-generators'
import { shouldCreateDatabaseColumn } from '../sql/sql-field-predicates'
import { generateColumnDefinition, generateTableConstraints } from '../sql/sql-generators'
import {
  generateIdColumn,
  needsAutomaticIdColumn,
  generateCreatedAtColumn,
  generateUpdatedAtColumn,
  generateDeletedAtColumn,
} from './column-generators'
import type { Table } from '@/domain/models/app/tables'

/**
 * Whether the automatic-id column should declare `PRIMARY KEY` inline on the column.
 *
 *, the SQLite `INTEGER PRIMARY KEY AUTOINCREMENT` contract requires
 * the PK to be declared inline on the column — a separate table-level
 * `PRIMARY KEY (id)` constraint under a bare `INTEGER` column will not
 * auto-generate values. On Postgres an inline `PRIMARY KEY` is also valid,
 * so this is dialect-agnostic.
 *
 * Two cases require inline-PK:
 *   1. The schema author declared `primaryKey: { fields: ['id'] }` explicitly.
 *   2. The default automatic-id path (no `primaryKey` declared at all) — the
 *      automatic id column gets the inline PK so its `AUTOINCREMENT`/`SERIAL`
 *      default actually fires.
 */
const requiresInlineIdPk = (table: Table, primaryKeyFields: readonly string[]): boolean => {
  const explicitPkOnId = primaryKeyFields.length === 1 && primaryKeyFields[0] === 'id'
  const defaultAutomaticIdPath =
    needsAutomaticIdColumn(table, primaryKeyFields) && primaryKeyFields.length === 0
  return explicitPkOnId || defaultAutomaticIdPath
}

/**
 * Everything the table-DDL generators need beyond the table itself.
 *
 * ONE type for all of them, deliberately. Every field here changes the emitted
 * DDL, and the same table is reached through three different paths — the fresh
 * CREATE, the recreate-and-copy, and the definition fingerprint that decides
 * whether a recreate is needed at all. A path reached with a different value
 * than another emits a DIFFERENT table for the SAME config, so the three cannot
 * be allowed to declare their own near-copies of this shape and drift apart.
 *
 * `tablePrimaryKeyTypes` is REQUIRED, and deliberately so. It used to be the
 * last of five optional positional arguments, which meant every caller that
 * stopped short of it silently produced a table whose `relationship` columns
 * fell back to the hardcoded `INTEGER` — so a foreign key onto a TEXT/UUID-keyed
 * parent could not be built and the boot died on `foreign key constraint … cannot
 * be implemented`. An optional argument that must always be passed is a comment;
 * a required one is a compile error. Pass `buildTablePrimaryKeyTypesMap(tables)`
 * built from the SAME post-defaults table list the rest of the migration uses.
 */
export type TableDdlInputs = {
  /** Map of table name → `primaryKey.type` (post-`applySchemaDefaults`). */
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
  /** Map of table names to whether they use a VIEW. */
  readonly tableUsesView?: ReadonlyMap<string, boolean>
  /** Skip foreign key constraints (for circular dependencies). */
  readonly skipForeignKeys?: boolean
  /** Whether the app has an auth config (affects NOT NULL on user fields). */
  readonly hasAuthConfig?: boolean
}

/**
 * Generate CREATE TABLE statement
 * When table has lookup fields, creates a base table (_base suffix) and will later create a VIEW
 */
export const generateCreateTableSQL = (table: Table, options: TableDdlInputs): string => {
  const { tablePrimaryKeyTypes, tableUsesView, skipForeignKeys, hasAuthConfig = true } = options
  // Sanitize table name for PostgreSQL (lowercase, underscores)
  const sanitized = sanitizeTableName(table.name)
  // Determine table name (add _base suffix if using VIEW for lookup fields)
  const tableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized

  // Identify primary key fields
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  // Generate automatic id column based on primary key type.
  //, declare PRIMARY KEY inline on the id column whenever the
  // automatic-id path produces it (see `requiresInlineIdPk` helper).
  const primaryKeyOnId = requiresInlineIdPk(table, primaryKeyFields)
  const idColumnDefinition = needsAutomaticIdColumn(table, primaryKeyFields)
    ? [generateIdColumn(table.primaryKey?.type, primaryKeyOnId)]
    : []

  // Filter out UI-only fields (like button), lookup fields, rollup fields, and
  // view-computed formulas (handled by VIEW). Lookup/rollup fields and formulas
  // that reference them don't exist as columns in the base table — they are
  // computed in the VIEW's CTE instead.
  const columnDefinitions = table.fields
    .filter(
      (field) =>
        shouldCreateDatabaseColumn(field) &&
        field.type !== 'lookup' &&
        field.type !== 'rollup' &&
        !isViewComputedFormula(field, table.fields)
    )
    .map((field) => {
      // Only add inline PRIMARY KEY for single-field composite keys (handled by generateSerialColumn)
      // Multi-field composite keys must have PRIMARY KEY at table level to avoid "multiple primary keys" error
      const isPrimaryKey = primaryKeyFields.includes(field.name) && primaryKeyFields.length === 1
      return generateColumnDefinition(
        field,
        isPrimaryKey,
        table.fields,
        hasAuthConfig,
        tablePrimaryKeyTypes
      )
    })

  // Add PRIMARY KEY constraint on id if no custom primary key is defined
  const tableConstraints = generateTableConstraints(table, tableUsesView, skipForeignKeys)

  const allDefinitions = [
    ...idColumnDefinition,
    ...generateCreatedAtColumn(table),
    ...generateUpdatedAtColumn(table),
    ...generateDeletedAtColumn(table),
    ...columnDefinitions,
    ...tableConstraints,
  ]

  return `CREATE TABLE IF NOT EXISTS ${tableName} (
  ${allDefinitions.join(',\n  ')}
)`
}
