/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * Pure derivation of a table's native `many-to-many` relationship
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
  // A table linked to itself keeps its links in ONE link table, both ends
  // read through the same field: there is no mirror table to write.
  if (relatedTable === sourceTable) return false
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

/** A `one-to-many` field and the column of the related table that points back. */
export interface OneToManyFieldSpec {
  readonly fieldName: string
  readonly relatedTable: string
  readonly reciprocalField: string
}

type OneToManyField = {
  readonly name: string
  readonly relatedTable: string
  readonly reciprocalField?: unknown
}

const isOneToManyField = (field: SchemaField): field is OneToManyField & SchemaField =>
  field.type === 'relationship' &&
  field.relationType === 'one-to-many' &&
  typeof field.relatedTable === 'string' &&
  typeof field.name === 'string'

/**
 * The related table's column that holds the link: the declared
 * `reciprocalField`, else the ONE to-one relationship of the related table that
 * points back at the source. Two candidates, or none, resolve nothing — a guess
 * would list another relation's rows under this one.
 */
const backReferenceOf = (
  tables: App['tables'],
  field: OneToManyField,
  sourceTable: string
): string | undefined => {
  if (typeof field.reciprocalField === 'string' && field.reciprocalField !== '') {
    return field.reciprocalField
  }
  const candidates = (tables?.find((t) => t.name === field.relatedTable)?.fields ?? []).filter(
    (other) =>
      other.type === 'relationship' &&
      'relatedTable' in other &&
      other.relatedTable === sourceTable &&
      (!('relationType' in other) ||
        other.relationType === undefined ||
        other.relationType === 'many-to-one')
  )
  return candidates.length === 1 ? candidates[0]?.name : undefined
}

/**
 * The one-to-many field specs for a table — the records of another table that
 * point at each of its records (empty when it declares none).
 */
export const getOneToManyFieldSpecs = (
  tables: App['tables'],
  tableName: string
): readonly OneToManyFieldSpec[] => {
  const table = tables?.find((t) => t.name === tableName)
  if (!table) return []
  return (table.fields as readonly SchemaField[]).filter(isOneToManyField).flatMap((field) => {
    const reciprocalField = backReferenceOf(tables, field, tableName)
    return reciprocalField === undefined
      ? []
      : [{ fieldName: field.name, relatedTable: field.relatedTable, reciprocalField }]
  })
}
