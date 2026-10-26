/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { deriveFieldLinkTableName } from '@/domain/models/app/tables/table-derived-name-validation'
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
  readonly reciprocalField?: unknown
}

/** A many-to-many field on the source table, plus junction metadata. */
export interface ManyToManyFieldSpec {
  readonly fieldName: string
  readonly relatedTable: string
  /** The field's own link table (`deriveFieldLinkTableName`). */
  readonly linkTable: string
  /**
   * The link table of the related table's field that is this field's
   * reciprocal, when the pairing is clear: every link written through this
   * field is mirrored there, so the reciprocal side reads it. Absent when no
   * field of the related table is this one's reciprocal.
   */
  readonly mirrorLinkTable?: string
}

type ManyToManyField = {
  readonly name: string
  readonly type: 'relationship'
  readonly relationType: 'many-to-many'
  readonly relatedTable: string
  readonly reciprocalField?: unknown
}

const isManyToManyField = (field: SchemaField): field is ManyToManyField =>
  field.type === 'relationship' &&
  field.relationType === 'many-to-many' &&
  typeof field.relatedTable === 'string' &&
  typeof field.name === 'string'

type SchemaTable = NonNullable<App['tables']>[number]

/** The many-to-many fields of `table` that point at `relatedTable`. */
const manyToManyTo = (table: SchemaTable, relatedTable: string): readonly ManyToManyField[] =>
  (table.fields as readonly SchemaField[])
    .filter(isManyToManyField)
    .filter((field) => field.relatedTable === relatedTable)

/** The `reciprocalField` a field names, or `undefined`. */
const namedReciprocal = (field: ManyToManyField): string | undefined =>
  typeof field.reciprocalField === 'string' && field.reciprocalField !== ''
    ? field.reciprocalField
    : undefined

/**
 * The field of the related table that is `field`'s reciprocal: the one either
 * side names by `reciprocalField`, else — when neither side names one — the
 * only many-to-many in each direction between the two tables. Anything else
 * pairs nothing: a guess would show one field's links under another. A table
 * linked to itself keeps its links in its own link table, read through the
 * same field: there is no mirror.
 */
const reciprocalOf = (
  tables: App['tables'],
  source: SchemaTable,
  field: ManyToManyField
): ManyToManyField | undefined => {
  if (field.relatedTable === source.name) return undefined
  const target = tables?.find((t) => t.name === field.relatedTable)
  if (!target) return undefined
  const candidates = manyToManyTo(target, source.name)
  const named = namedReciprocal(field)
  if (named !== undefined) return candidates.find((candidate) => candidate.name === named)
  const naming = candidates.find((candidate) => namedReciprocal(candidate) === field.name)
  if (naming !== undefined) return naming
  const [only] = candidates
  return candidates.length === 1 &&
    only !== undefined &&
    namedReciprocal(only) === undefined &&
    manyToManyTo(source, field.relatedTable).length === 1
    ? only
    : undefined
}

/** What a read of `spec`'s links names: the field, the table it links to, its link table. */
export const linkReadOf = (spec: ManyToManyFieldSpec) => ({
  fieldName: spec.fieldName,
  relatedTable: spec.relatedTable,
  linkTable: spec.linkTable,
})

/** The link tables a write through `spec` reaches: its own, and its reciprocal's when paired. */
export const linkTablesOf = (spec: ManyToManyFieldSpec) => ({
  linkTable: spec.linkTable,
  ...(spec.mirrorLinkTable === undefined ? {} : { mirrorLinkTable: spec.mirrorLinkTable }),
})

/**
 * The link table the many-to-many `field` of `tableName` stores its links in,
 * read from the table's own fields (`deriveFieldLinkTableName`).
 */
export const fieldLinkTable = (
  tables: App['tables'],
  tableName: string,
  field: { readonly name: string; readonly relatedTable: string }
): string =>
  deriveFieldLinkTableName(
    { name: tableName, fields: tables?.find((t) => t.name === tableName)?.fields ?? [] },
    field
  )

/**
 * The many-to-many field specs for a table (empty when the table has none).
 */
export const getManyToManyFieldSpecs = (
  tables: App['tables'],
  tableName: string
): readonly ManyToManyFieldSpec[] => {
  const table = tables?.find((t) => t.name === tableName)
  if (!table) return []
  return (table.fields as readonly SchemaField[]).filter(isManyToManyField).map((field) => {
    const reciprocal = reciprocalOf(tables, table, field)
    const target = tables?.find((t) => t.name === field.relatedTable)
    return {
      fieldName: field.name,
      relatedTable: field.relatedTable,
      linkTable: deriveFieldLinkTableName(table, field),
      ...(reciprocal === undefined || target === undefined
        ? {}
        : { mirrorLinkTable: deriveFieldLinkTableName(target, reciprocal) }),
    }
  })
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
