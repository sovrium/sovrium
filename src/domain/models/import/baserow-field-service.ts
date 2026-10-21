/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Baserow fields and cells, shared by the two Baserow inputs: the workspace
 * export ZIP and a REST snapshot written by `sovrium import fetch`.
 *
 * A field keeps its Baserow type and every type option verbatim. A few keys
 * are ADDED beside them, in the names the one table mapper reads for every
 * source (Airtable's spelling):
 *
 * - `linkedTableId` and `inverseLinkFieldId`, the table a `link_row` points at
 *   and the field that links back from it;
 * - `recordLinkFieldId` and `fieldIdInLinkedTable`, the link a lookup, rollup
 *   or count reads through and the field it reads on the other side;
 * - `result: { type }`, the type of the values a formula, lookup, rollup or
 *   count holds — the type its column keeps when the calculation cannot be
 *   rebuilt.
 *
 * One spelling is Baserow's option rather than its type: a `date` field with
 * `date_include_time` is typed `date_include_time`, so the mapping table can
 * send it to `datetime` instead of cutting its time off.
 *
 * Cells are converted to the canonical shapes: numbers Baserow serves as text
 * become numbers, select option ids or objects become their labels, link ids
 * become links, files become attachments. A `password` field's value is never
 * read: it is a credential, and it stays behind.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import type { CanonicalField, CanonicalRecord, CanonicalValue } from './canonical-base'

export type Json = Readonly<Record<string, unknown>>

/** An id as text: Baserow ids are numbers, canonical ids are strings. */
export const idOf = (value: unknown): string | undefined =>
  typeof value === 'number' || (typeof value === 'string' && value !== '')
    ? String(value)
    : undefined

/** The keys every Baserow field has; the rest are its type's options. */
const COMMON_KEYS = new Set([
  'id',
  'type',
  'name',
  'order',
  'primary',
  'description',
  'table_id',
  'read_only',
  'db_index',
  'immutable_type',
  'immutable_properties',
  'database_id',
  'workspace_id',
])

/** The types whose value is computed by Baserow, and what they read as. */
const COMPUTED_RESULT_KEYS: Readonly<Record<string, readonly string[]>> = {
  formula: ['formula_type'],
  lookup: ['array_formula_type', 'formula_type'],
  rollup: ['formula_type'],
  count: ['formula_type'],
}

/** A computed field's result type; a rollup or a count of nothing named is a number. */
const resultTypeOf = (type: string, field: Json): string | undefined => {
  const keys = COMPUTED_RESULT_KEYS[type]
  if (keys === undefined) return undefined
  const named = keys.map((key) => field[key]).find((value) => typeof value === 'string')
  if (typeof named === 'string') return named
  return type === 'rollup' || type === 'count' ? 'number' : undefined
}

/** The source type the mapping table is read with. */
const sourceTypeOf = (type: string, field: Json): string =>
  type === 'date' && field['date_include_time'] === true ? 'date_include_time' : type

/** A non-empty text, or `undefined`. */
const textOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** The normalised key the mapper reads, by the Baserow option that states it. */
const NORMALISED_IDS: readonly (readonly [string, string])[] = [
  ['link_row_table_id', 'linkedTableId'],
  ['link_row_related_field_id', 'inverseLinkFieldId'],
  ['through_field_id', 'recordLinkFieldId'],
  ['target_field_id', 'fieldIdInLinkedTable'],
]

/** A field's type options verbatim, plus the keys the mapper reads. */
const optionsOf = (type: string, field: Json): Json => {
  const resultType = resultTypeOf(type, field)
  const normalised = NORMALISED_IDS.flatMap(([from, to]) => {
    const id = idOf(field[from])
    return id === undefined ? [] : [[to, id] as const]
  })
  return {
    ...Object.fromEntries(Object.entries(field).filter(([key]) => !COMMON_KEYS.has(key))),
    ...Object.fromEntries(normalised),
    ...(resultType === undefined ? {} : { result: { type: resultType } }),
  }
}

/** One serialized Baserow field as a canonical field, or `undefined` when it has no id. */
export const baserowField = (field: Json): CanonicalField | undefined => {
  const sourceId = idOf(field['id'])
  const type = textOrUndefined(field['type'])
  if (sourceId === undefined || type === undefined) return undefined
  const description = textOrUndefined(field['description'])
  return {
    sourceId,
    name: textOrUndefined(field['name']) ?? sourceId,
    sourceType: sourceTypeOf(type, field),
    options: optionsOf(type, field),
    ...(field['primary'] === true ? { primary: true } : {}),
    ...(description === undefined ? {} : { description }),
  }
}

/** Where a cell's links and files are resolved. */
export interface CellContext {
  /** The snapshot asset of a Baserow user file, by its internal name. */
  readonly assetOf: (name: string) => string | undefined
}

/** A Baserow number: a number, or the text Baserow serves it as. `NaN` is no value. */
const numberOf = (value: unknown): number | undefined => {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined
}

/** A select option's label: from its id against the field's options, or the object itself. */
const optionLabel = (field: CanonicalField, value: unknown): string | undefined => {
  if (isRecord(value)) return typeof value['value'] === 'string' ? value['value'] : undefined
  const id = idOf(value)
  const option = arrayOf(field.options?.['select_options']).find(
    (candidate) => isRecord(candidate) && idOf(candidate['id']) === id
  )
  return isRecord(option) && typeof option['value'] === 'string' ? option['value'] : undefined
}

const linkOf = (field: CanonicalField, value: unknown): CanonicalValue | undefined => {
  const table = field.options?.['linkedTableId']
  const record = idOf(isRecord(value) ? value['id'] : value)
  return typeof table === 'string' && record !== undefined
    ? { kind: 'link', table, record }
    : undefined
}

const attachmentOf = (value: unknown, context: CellContext): CanonicalValue | undefined => {
  if (!isRecord(value) || typeof value['name'] !== 'string') return undefined
  const asset = context.assetOf(value['name'])
  const shown = value['visible_name']
  return {
    kind: 'attachment',
    filename: typeof shown === 'string' && shown !== '' ? shown : value['name'],
    ...(asset === undefined ? {} : { asset }),
    ...(typeof value['mime_type'] === 'string' ? { mimeType: value['mime_type'] } : {}),
  }
}

/** A collaborator: an email (the export), or `{ id, name }` (the API, which gives no email). */
const userOf = (value: unknown): CanonicalValue | undefined => {
  const email = isRecord(value) ? value['email'] : value
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+$/.test(email)
    ? { kind: 'user', email }
    : undefined
}

/** A cell kept as text: a list's items joined, an object's `value` or `name`. */
const textOf = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined
  if (Array.isArray(value)) {
    const parts = value.flatMap((item) => {
      const text = textOf(item)
      return text === undefined || text === '' ? [] : [text]
    })
    return parts.length === 0 ? undefined : parts.join(', ')
  }
  if (isRecord(value)) {
    const shown = value['value'] ?? value['name'] ?? value['visible_name']
    return shown === undefined ? JSON.stringify(value) : textOf(shown)
  }
  return String(value)
}

/** A list cell: each item converted, the ones that convert to nothing dropped. */
const listOf = (
  value: unknown,
  convert: (item: unknown) => CanonicalValue | undefined
): CanonicalValue | undefined => {
  const items = arrayOf(value).flatMap((item) => {
    const converted = convert(item)
    return converted === undefined ? [] : [converted]
  })
  return items.length === 0 ? undefined : (items as CanonicalValue)
}

type Converter = (field: CanonicalField, value: unknown, context: CellContext) => unknown

const asNumber: Converter = (_field, value) => numberOf(value)

const asBoolean: Converter = (_field, value) =>
  typeof value === 'boolean'
    ? value
    : value === 'true'
      ? true
      : value === 'false'
        ? false
        : undefined

const asSelect: Converter = (field, value) => optionLabel(field, value)

const asMultiSelect: Converter = (field, value) => {
  const labels = arrayOf(value).flatMap((item) => {
    const label = optionLabel(field, item)
    return label === undefined ? [] : [label]
  })
  return labels.length === 0 ? undefined : labels
}

const asLinks: Converter = (field, value) => listOf(value, (item) => linkOf(field, item))

const asFiles: Converter = (_field, value, context) =>
  listOf(value, (item) => attachmentOf(item, context))

const asUsers: Converter = (_field, value) => listOf(value, userOf)

/** The result type a computed field states. */
const resultOf = (field: CanonicalField): unknown => {
  const result = field.options?.['result']
  return isRecord(result) ? result['type'] : undefined
}

/** A computed value, read as its result type: a number, a boolean, or text. */
const asComputed: Converter = (field, value) => {
  if (resultOf(field) === 'number') return numberOf(value)
  return typeof value === 'boolean' ? value : textOf(value)
}

const CONVERTERS: Readonly<Record<string, Converter>> = {
  number: asNumber,
  rating: asNumber,
  duration: asNumber,
  autonumber: asNumber,
  count: asNumber,
  rollup: asNumber,
  boolean: asBoolean,
  single_select: asSelect,
  multiple_select: asMultiSelect,
  link_row: asLinks,
  file: asFiles,
  multiple_collaborators: asUsers,
  // The creator and the last editor are system columns Sovrium fills itself,
  // not collaborators: no value is kept and no account is seeded for them.
  created_by: () => undefined,
  last_modified_by: () => undefined,
  formula: asComputed,
  lookup: asComputed,
  password: () => undefined,
}

/** One cell as a canonical value, or `undefined` when the cell is empty. */
export const baserowCell = (
  field: CanonicalField,
  value: unknown,
  context: CellContext
): CanonicalValue | undefined => {
  if (value === null || value === undefined || value === '') return undefined
  const type = field.sourceType === 'date_include_time' ? 'date' : field.sourceType
  const convert = CONVERTERS[type]
  const converted = convert === undefined ? textOf(value) : convert(field, value, context)
  return converted === undefined || converted === '' ? undefined : (converted as CanonicalValue)
}

/** One row as a canonical record: its values read through `cellOf`, keyed by field id. */
export const baserowRecord = (
  row: Json,
  fields: readonly CanonicalField[],
  cellOf: (field: CanonicalField) => unknown,
  context: CellContext
): CanonicalRecord | undefined => {
  const sourceId = idOf(row['id'])
  if (sourceId === undefined) return undefined
  const values = Object.fromEntries(
    fields.flatMap((field) => {
      const value = baserowCell(field, cellOf(field), context)
      return value === undefined ? [] : [[field.sourceId, value] as const]
    })
  )
  const created = row['created_on']
  return {
    sourceId,
    values,
    ...(typeof created === 'string' && created !== '' ? { createdAt: created } : {}),
  }
}

/** Every collaborator email the records name, sorted, once each. */
export const usersOf = (
  records: readonly CanonicalRecord[]
): readonly { readonly email: string }[] =>
  [
    ...new Set(
      records.flatMap((record) =>
        Object.values(record.values).flatMap((value) =>
          (Array.isArray(value) ? value : [value]).flatMap((item) =>
            isRecord(item) && item['kind'] === 'user' && typeof item['email'] === 'string'
              ? [item['email']]
              : []
          )
        )
      )
    ),
  ]
    .toSorted()
    .map((email) => ({ email }))
