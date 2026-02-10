/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { shouldCreateDatabaseColumn, sanitizeTableName } from '../field-utils'
import { shouldUseView, getBaseTableName } from '../lookup-view-generators'
import { generateColumnDefinition, generateTableConstraints } from '../sql-generators'
import {
  generateIdColumn,
  needsAutomaticIdColumn,
  generateCreatedAtColumn,
  generateUpdatedAtColumn,
  generateDeletedAtColumn,
  generatePrimaryKeyConstraintIfNeeded,
} from './column-generators'
import type { Table } from '@/domain/models/app/table'

/**
 * Generate CREATE TABLE statement
 * When table has lookup fields, creates a base table (_base suffix) and will later create a VIEW
 *
 * @param table - Table definition
 * @param tableUsesView - Map of table names to whether they use a VIEW
 * @param skipForeignKeys - Skip foreign key constraints (for circular dependencies)
 */
export const generateCreateTableSQL = (
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>,
  skipForeignKeys?: boolean
): string => {
  // Sanitize table name for PostgreSQL (lowercase, underscores)
  const sanitized = sanitizeTableName(table.name)
  // Determine table name (add _base suffix if using VIEW for lookup fields)
  const tableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized

  // Identify primary key fields
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  // Generate automatic id column based on primary key type
  // Add PRIMARY KEY inline if the primary key is on the 'id' field
  const primaryKeyOnId = primaryKeyFields.length === 1 && primaryKeyFields[0] === 'id'
  const idColumnDefinition = needsAutomaticIdColumn(table, primaryKeyFields)
    ? [generateIdColumn(table.primaryKey?.type, primaryKeyOnId)]
    : []

  // Filter out UI-only fields (like button), lookup fields, and rollup fields (handled by VIEW)
  // Lookup and rollup fields don't exist as columns in the base table
  const columnDefinitions = table.fields
    .filter(
      (field) =>
        shouldCreateDatabaseColumn(field) && field.type !== 'lookup' && field.type !== 'rollup'
    )
    .map((field) => {
      // Only add inline PRIMARY KEY for single-field composite keys (handled by generateSerialColumn)
      // Multi-field composite keys must have PRIMARY KEY at table level to avoid "multiple primary keys" error
      const isPrimaryKey = primaryKeyFields.includes(field.name) && primaryKeyFields.length === 1
      return generateColumnDefinition(field, isPrimaryKey, table.fields)
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
    ...generatePrimaryKeyConstraintIfNeeded(table, primaryKeyFields),
  ]

  return `CREATE TABLE IF NOT EXISTS ${tableName} (
  ${allDefinitions.join(',\n  ')}
)`
}
