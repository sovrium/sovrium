/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Detect field renames by comparing field IDs between previous and current schema
 * Returns a map of old field name to new field name for renamed fields
 */
export const detectFieldRenames = (
  tableName: string,
  currentFields: readonly Fields[number][],
  previousSchema?: { readonly tables: readonly object[] }
): ReadonlyMap<string, string> => {
  if (!previousSchema) return new Map()

  // Find previous table definition
  const previousTable = previousSchema.tables.find(
    (t: object) => 'name' in t && t.name === tableName
  ) as { name: string; fields?: readonly { id?: number; name?: string }[] } | undefined

  if (!previousTable || !previousTable.fields) return new Map()

  // Build map of field ID to field name for both schemas
  const previousFieldsById = new Map(
    previousTable.fields
      .filter((f) => f.id !== undefined && f.name !== undefined)
      .map((f) => [f.id!, f.name!])
  )

  const currentFieldsById = new Map(
    currentFields.filter((f) => f.id !== undefined).map((f) => [f.id, f.name])
  )

  // Detect renames: same ID, different name
  const renames = new Map<string, string>()
  currentFieldsById.forEach((newName, fieldId) => {
    const oldName = previousFieldsById.get(fieldId)
    if (oldName && oldName !== newName) {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
      renames.set(oldName, newName)
    }
  })

  return renames
}

/**
 * Detect table renames by comparing table IDs between previous and current schema
 * Returns a map of old table name to new table name for renamed tables
 */
export const detectTableRenames = (
  currentTables: readonly Table[],
  previousSchema?: { readonly tables: readonly object[] }
): ReadonlyMap<string, string> => {
  if (!previousSchema) return new Map()

  // Build map of table ID to table name for both schemas
  const previousTablesById = new Map(
    previousSchema.tables
      .filter((t: object) => 'id' in t && 'name' in t && t.id !== undefined && t.name !== undefined)
      .map((t: object) => [(t as { id: number }).id, (t as { name: string }).name])
  )

  const currentTablesById = new Map(
    currentTables
      .filter((t): t is Table & { id: number } => t.id !== undefined)
      .map((t) => [t.id, t.name])
  )

  // Detect renames: same ID, different name
  const renames = new Map<string, string>()
  currentTablesById.forEach((newName, tableId) => {
    const oldName = previousTablesById.get(tableId)
    if (oldName && oldName !== newName) {
      // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements
      renames.set(oldName, newName)
    }
  })

  return renames
}
