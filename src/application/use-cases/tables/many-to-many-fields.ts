/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * [internal ref]: pure derivation of a table's native `many-to-many` relationship
 * fields from the app schema. A many-to-many field has no base column — its
 * value lives in an auto-generated junction table — so the record-create
 * pipeline must split it from the base INSERT and the read pipeline must
 * resolve it from the junction. This helper is the schema-level source of that
 * information, kept pure so both the create and read programs share it.
 */

type SchemaField = {
  readonly name?: unknown
  readonly type?: unknown
  readonly relationType?: unknown
  readonly relatedTable?: unknown
}

/** A many-to-many field on the source table, plus junction metadata. */
export interface ManyToManyFieldSpec {
  readonly fieldName: string
  readonly relatedTable: string
  /**
   * Whether the related table declares a reciprocal many-to-many field back to
   * the source table (so the mirror junction `<relatedTable>_<sourceTable>`
   * exists and must also be written / can be read).
   */
  readonly hasReciprocal: boolean
}

const isManyToManyField = (
  field: SchemaField
): field is {
  name: string
  type: 'relationship'
  relationType: 'many-to-many'
  relatedTable: string
} =>
  field.type === 'relationship' &&
  field.relationType === 'many-to-many' &&
  typeof field.relatedTable === 'string' &&
  typeof field.name === 'string'

/** Does `relatedTable` declare a many-to-many field pointing back at `sourceTable`? */
const relatedTablePointsBack = (
  tables: App['tables'],
  relatedTable: string,
  sourceTable: string
): boolean => {
  const target = tables?.find((t) => t.name === relatedTable)
  if (!target) return false
  return target.fields.some(
    (field) => isManyToManyField(field) && field.relatedTable === sourceTable
  )
}

/**
 * The many-to-many field specs for a table (empty when the table has none).
 */
export const getManyToManyFieldSpecs = (
  tables: App['tables'],
  tableName: string
): readonly ManyToManyFieldSpec[] => {
  const table = tables?.find((t) => t.name === tableName)
  if (!table) return []
  return table.fields.filter(isManyToManyField).map((field) => ({
    fieldName: field.name,
    relatedTable: field.relatedTable,
    hasReciprocal: relatedTablePointsBack(tables, field.relatedTable, tableName),
  }))
}
