/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { shouldUseView, getBaseTableName } from '../lookup/lookup-view-generators'
import { generateColumnDefinition, generateTableConstraints } from '../sql/sql-generators'
import { shouldCreateDatabaseColumn, sanitizeTableName } from '../table-queries/shared/field-utils'
import {
  generateIdColumn,
  needsAutomaticIdColumn,
  generateCreatedAtColumn,
  generateUpdatedAtColumn,
  generateDeletedAtColumn,
  generatePrimaryKeyConstraintIfNeeded,
} from './column-generators'
import type { Table } from '@/domain/models/app/tables'

export const generateCreateTableSQL = (
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>,
  skipForeignKeys?: boolean,
  hasAuthConfig: boolean = true
): string => {
  const sanitized = sanitizeTableName(table.name)
  const tableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized

  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  const primaryKeyOnId = primaryKeyFields.length === 1 && primaryKeyFields[0] === 'id'
  const idColumnDefinition = needsAutomaticIdColumn(table, primaryKeyFields)
    ? [generateIdColumn(table.primaryKey?.type, primaryKeyOnId)]
    : []

  const columnDefinitions = table.fields
    .filter(
      (field) =>
        shouldCreateDatabaseColumn(field) && field.type !== 'lookup' && field.type !== 'rollup'
    )
    .map((field) => {
      const isPrimaryKey = primaryKeyFields.includes(field.name) && primaryKeyFields.length === 1
      return generateColumnDefinition(field, isPrimaryKey, table.fields, hasAuthConfig)
    })

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
