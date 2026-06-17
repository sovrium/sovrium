/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isViewComputedFormula } from '../formula/formula-utils'
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

const requiresInlineIdPk = (table: Table, primaryKeyFields: readonly string[]): boolean => {
  const explicitPkOnId = primaryKeyFields.length === 1 && primaryKeyFields[0] === 'id'
  const defaultAutomaticIdPath =
    needsAutomaticIdColumn(table, primaryKeyFields) && primaryKeyFields.length === 0
  return explicitPkOnId || defaultAutomaticIdPath
}

export const generateCreateTableSQL = (
  table: Table,
  tableUsesView?: ReadonlyMap<string, boolean>,
  skipForeignKeys?: boolean,
  hasAuthConfig: boolean = true,
  tablePrimaryKeyTypes?: ReadonlyMap<string, string | undefined>
): string => {
  const sanitized = sanitizeTableName(table.name)
  const tableName = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized

  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

  const primaryKeyOnId = requiresInlineIdPk(table, primaryKeyFields)
  const idColumnDefinition = needsAutomaticIdColumn(table, primaryKeyFields)
    ? [generateIdColumn(table.primaryKey?.type, primaryKeyOnId)]
    : []

  const columnDefinitions = table.fields
    .filter(
      (field) =>
        shouldCreateDatabaseColumn(field) &&
        field.type !== 'lookup' &&
        field.type !== 'rollup' &&
        !isViewComputedFormula(field, table.fields)
    )
    .map((field) => {
      const isPrimaryKey = primaryKeyFields.includes(field.name) && primaryKeyFields.length === 1
      return generateColumnDefinition(
        field,
        isPrimaryKey,
        table.fields,
        hasAuthConfig,
        tablePrimaryKeyTypes
      )
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
