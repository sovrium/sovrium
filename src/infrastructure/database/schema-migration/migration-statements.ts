/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  generateCreatedAtColumn,
  generateDeletedAtColumn,
  generateUpdatedAtColumn,
} from '../table-operations/column-generators'
import {
  needsIdColumnRecreation,
  findColumnsToAdd,
  findColumnsToDrop,
  findTypeChanges,
  findNullabilityChanges,
  findDefaultValueChanges,
  buildColumnStatements,
  type ExistingColumnInfo,
} from './column-detection'
import { detectFieldRenames } from './rename-detection'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

type MissingSpecialFields = {
  readonly created: boolean
  readonly updated: boolean
  readonly deleted: boolean
}

const sqliteSpecialFieldStatements = (
  table: Table,
  missing: MissingSpecialFields
): readonly string[] => {
  const addColumns = (defs: readonly string[]): readonly string[] =>
    defs.map((def) => `ALTER TABLE ${table.name} ADD COLUMN ${def}`)
  return [
    ...(missing.created ? addColumns(generateCreatedAtColumn(table)) : []),
    ...(missing.updated ? addColumns(generateUpdatedAtColumn(table)) : []),
    ...(missing.deleted ? addColumns(generateDeletedAtColumn(table)) : []),
  ]
}

const generateSpecialFieldStatements = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>
): readonly string[] => {
  const fieldNames = new Set(table.fields.map((f) => f.name))
  const missing: MissingSpecialFields = {
    created: !fieldNames.has('created_at') && !existingColumns.has('created_at'),
    updated: !fieldNames.has('updated_at') && !existingColumns.has('updated_at'),
    deleted: !fieldNames.has('deleted_at') && !existingColumns.has('deleted_at'),
  }

  if (isSqliteRuntime()) return sqliteSpecialFieldStatements(table, missing)

  return [
    ...(missing.created
      ? [`ALTER TABLE ${table.name} ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`]
      : []),
    ...(missing.updated
      ? [`ALTER TABLE ${table.name} ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`]
      : []),
    ...(missing.deleted ? [`ALTER TABLE ${table.name} ADD COLUMN deleted_at TIMESTAMPTZ`] : []),
  ]
}

const validateDestructiveOps = (table: Table, columnsToDrop: readonly string[]): void => {
  if (columnsToDrop.length > 0 && !table.allowDestructive) {
    const droppedColumns = columnsToDrop.join(', ')
    throw new Error(
      `Destructive operation detected: Dropping column(s) [${droppedColumns}] from table '${table.name}' requires confirmation. Set allowDestructive: true to proceed with data loss, or keep the field(s) in the schema to preserve data.`
    )
  }
}

const computeIdProtection = (
  table: Table
): { readonly shouldProtectIdColumn: boolean; readonly primaryKeyFields: readonly string[] } => {
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []
  const hasIdField = table.fields.some((field) => field.name === 'id')
  const shouldProtectIdColumn = !hasIdField && !(table.primaryKey && primaryKeyFields.length > 0)
  return { shouldProtectIdColumn, primaryKeyFields }
}

export const needsTableRecreation = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>
): boolean => {
  const { shouldProtectIdColumn } = computeIdProtection(table)
  return needsIdColumnRecreation(existingColumns, shouldProtectIdColumn)
}

const canonicalize = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(canonicalize)
  const record = value as Record<string, unknown>
  return Object.keys(record)
    .toSorted()
    .reduce<Record<string, unknown>>(
      (acc, key) => ({ ...acc, [key]: canonicalize(record[key]) }),
      {}
    )
}

export const isTableDefinitionUnchanged = (
  table: Table,
  previousSchema?: { readonly tables: readonly object[] }
): boolean => {
  const previousTable = previousSchema?.tables.find(
    (t) =>
      typeof t === 'object' &&
      t !== null &&
      'name' in t &&
      (t as { name?: unknown }).name === table.name
  )
  if (!previousTable) return false
  return JSON.stringify(canonicalize(table)) === JSON.stringify(canonicalize(previousTable))
}

export const generateAlterTableStatements = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  previousSchema?: { readonly tables: readonly object[] }
): readonly string[] => {
  const { shouldProtectIdColumn, primaryKeyFields } = computeIdProtection(table)

  if (needsIdColumnRecreation(existingColumns, shouldProtectIdColumn)) return []

  const fieldRenames = detectFieldRenames(table.name, table.fields, previousSchema)
  const renameStatements = Array.from(fieldRenames.entries()).map(
    ([oldName, newName]) => `ALTER TABLE ${table.name} RENAME COLUMN ${oldName} TO ${newName}`
  )

  const renamedOldNames = new Set(fieldRenames.keys())
  const renamedNewNames = new Set(fieldRenames.values())
  const schemaFieldsByName = new Map<string, Fields[number]>(
    table.fields.map((field) => [field.name, field])
  )

  const columnsToAdd = findColumnsToAdd(table, existingColumns, renamedNewNames)
  const columnsToDrop = findColumnsToDrop(
    existingColumns,
    schemaFieldsByName,
    shouldProtectIdColumn,
    renamedOldNames
  )

  validateDestructiveOps(table, columnsToDrop)

  const { dropStatements, addStatements } = buildColumnStatements({
    tableName: table.name,
    columnsToDrop,
    columnsToAdd,
    primaryKeyFields,
    allFields: table.fields,
  })

  const columnReshapeStatements = isSqliteRuntime()
    ? []
    : [
        ...findTypeChanges(table, existingColumns, renamedNewNames),
        ...findDefaultValueChanges(table, existingColumns, renamedNewNames, previousSchema),
        ...findNullabilityChanges(table, existingColumns, renamedNewNames, primaryKeyFields),
      ]

  return [
    ...renameStatements,
    ...dropStatements,
    ...addStatements,
    ...generateSpecialFieldStatements(table, existingColumns),
    ...columnReshapeStatements,
  ]
}
