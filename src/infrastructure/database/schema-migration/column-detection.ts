/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { generateColumnDefinition, isFieldNotNull } from '../sql/sql-generators'
import { shouldCreateDatabaseColumn } from '../table-queries/shared/field-utils'
import {
  normalizeDataType,
  doesColumnTypeMatch,
  generateAlterColumnTypeStatement,
} from './type-utils'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

export type ExistingColumnInfo = {
  dataType: string
  isNullable: string
  columnDefault: string | null
}

export const needsIdColumnRecreation = (
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  shouldProtectIdColumn: boolean
): boolean => {
  if (!shouldProtectIdColumn) return false
  if (!existingColumns.has('id')) return false

  const idType = normalizeDataType(existingColumns.get('id')!.dataType)
  return idType !== 'integer' && idType !== 'serial'
}

export const findColumnsToAdd = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>
): readonly Fields[number][] =>
  table.fields.filter((field) => {
    if (!shouldCreateDatabaseColumn(field)) return false
    if (renamedNewNames.has(field.name)) return false
    if (!existingColumns.has(field.name)) return true
    return false
  })

export const findColumnsToDrop = (
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  schemaFieldsByName: ReadonlyMap<string, Fields[number]>,
  shouldProtectIdColumn: boolean,
  renamedOldNames: ReadonlySet<string>
): readonly string[] =>
  Array.from(existingColumns.keys()).filter((columnName) => {
    if (shouldProtectIdColumn && columnName === 'id') return false

    if (columnName === 'created_at') return false
    if (columnName === 'updated_at') return false
    if (columnName === 'deleted_at') return false

    if (renamedOldNames.has(columnName)) return false

    if (!schemaFieldsByName.has(columnName)) return true

    const field = schemaFieldsByName.get(columnName)!

    if (!shouldCreateDatabaseColumn(field)) return true

    return false
  })

export const filterModifiableFields = (
  fields: readonly Fields[number][],
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>
): readonly Fields[number][] =>
  fields.filter((field) => {
    if (!shouldCreateDatabaseColumn(field)) return false
    if (renamedNewNames.has(field.name)) return false
    if (!existingColumns.has(field.name)) return false
    return true
  })

export const findTypeChanges = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>
): readonly string[] =>
  filterModifiableFields(table.fields, existingColumns, renamedNewNames).flatMap((field) => {
    const existing = existingColumns.get(field.name)!
    if (doesColumnTypeMatch(field, existing.dataType)) return []

    return [generateAlterColumnTypeStatement(table.name, field, existing.dataType)]
  })

export const generateNotNullValidationQuery = (tableName: string, fieldName: string): string => `
  DO $$
  DECLARE
    null_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO null_count
    FROM ${tableName}
    WHERE ${fieldName} IS NULL;

    IF null_count > 0 THEN
      RAISE EXCEPTION 'Migration failed: cannot add NOT NULL constraint to column "${fieldName}" in table "${tableName}" because % existing row(s) contain null values. Either provide a default value or update existing rows first.', null_count;
    END IF;
  END$$;
`

export const generateBackfillQuery = (table: Table, field: Fields[number]): string => {
  const columnDef = generateColumnDefinition(field, false, table.fields)
  const defaultMatch = columnDef.match(/DEFAULT\s+('(?:[^']|'')*'|[^\s]+)/)
  if (!defaultMatch) {
    return ''
  }

  const defaultClause = defaultMatch[1]
  return `UPDATE ${table.name} SET ${field.name} = ${defaultClause} WHERE ${field.name} IS NULL`
}

export const findNullabilityChanges = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>,
  primaryKeyFields: readonly string[]
): readonly string[] =>
  filterModifiableFields(table.fields, existingColumns, renamedNewNames).flatMap((field) => {
    const existing = existingColumns.get(field.name)!
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    const shouldBeNotNull = isFieldNotNull(field, isPrimaryKey)
    const currentlyNotNull = existing.isNullable === 'NO'

    if (shouldBeNotNull && !currentlyNotNull) {
      const hasDefault = 'default' in field && field.default !== undefined

      if (hasDefault) {
        const backfillQuery = generateBackfillQuery(table, field)
        return [
          ...(backfillQuery ? [backfillQuery] : []),
          `ALTER TABLE ${table.name} ALTER COLUMN ${field.name} SET NOT NULL`,
        ]
      }

      return [
        generateNotNullValidationQuery(table.name, field.name),
        `ALTER TABLE ${table.name} ALTER COLUMN ${field.name} SET NOT NULL`,
      ]
    }
    if (!shouldBeNotNull && currentlyNotNull && !isPrimaryKey) {
      return [`ALTER TABLE ${table.name} ALTER COLUMN ${field.name} DROP NOT NULL`]
    }
    return []
  })

export const findDefaultValueChanges = (
  table: Table,
  existingColumns: ReadonlyMap<string, ExistingColumnInfo>,
  renamedNewNames: ReadonlySet<string>,
  previousSchema?: { readonly tables: readonly object[] }
): readonly string[] => {
  const previousTable = previousSchema?.tables.find(
    (t: object) => 'name' in t && t.name === table.name
  ) as
    | {
        name: string
        fields?: readonly { id?: number; name?: string; default?: unknown }[]
      }
    | undefined

  const previousFieldsByName = new Map(
    previousTable?.fields?.filter((f) => f.name !== undefined).map((f) => [f.name!, f.default]) ??
      []
  )

  return filterModifiableFields(table.fields, existingColumns, renamedNewNames).flatMap((field) => {
    const currentDefault = 'default' in field ? field.default : undefined
    const previousDefault = previousFieldsByName.get(field.name)

    if (currentDefault === previousDefault) return []

    if (previousDefault !== undefined && currentDefault === undefined) {
      return [`ALTER TABLE ${table.name} ALTER COLUMN ${field.name} DROP DEFAULT`]
    }

    if (currentDefault !== undefined) {
      const columnDef = generateColumnDefinition(field, false, table.fields)
      const defaultMatch = columnDef.match(/DEFAULT\s+('(?:[^']|'')*'|[^\s]+)/)
      if (defaultMatch) {
        const defaultClause = defaultMatch[1]
        return [`ALTER TABLE ${table.name} ALTER COLUMN ${field.name} SET DEFAULT ${defaultClause}`]
      }
    }

    return []
  })
}

export const buildColumnStatements = (options: {
  readonly tableName: string
  readonly columnsToDrop: readonly string[]
  readonly columnsToAdd: readonly Fields[number][]
  readonly primaryKeyFields: readonly string[]
  readonly allFields: readonly Fields[number][]
}): { readonly dropStatements: readonly string[]; readonly addStatements: readonly string[] } => {
  const { tableName, columnsToDrop, columnsToAdd, primaryKeyFields, allFields } = options
  const cascadeSuffix = isSqliteRuntime() ? '' : ' CASCADE'
  const dropStatements = columnsToDrop.map(
    (columnName) => `ALTER TABLE ${tableName} DROP COLUMN ${columnName}${cascadeSuffix}`
  )
  const addStatements = columnsToAdd.map((field) => {
    const isPrimaryKey = primaryKeyFields.includes(field.name)
    const columnDef = generateColumnDefinition(field, isPrimaryKey, allFields)
    return `ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`
  })
  return { dropStatements, addStatements }
}
