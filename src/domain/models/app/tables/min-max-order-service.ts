/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `min` or `max` over one field orders: numbers, dates, or neither.
 *
 * `min` and `max` are ordering questions, and « the earliest due date » is one
 * an app asks as often as « the smallest amount ». A number orders by
 * magnitude; a `date` or `datetime` orders in time and answers as an ISO
 * string — a `date` as its day on both engines, even where PostgreSQL's list
 * reads the field back as a UTC-midnight timestamp. Any other field has no
 * order the answer could mean, so a `min`/`max` naming it is refused rather
 * than answered with nothing.
 *
 * A lookup orders as the field it copies — through a link to ONE record. A
 * lookup through a link to many records joins their values into text, so it
 * is refused too (a `rollup` aggregates across linked records).
 *
 * A name the table does not declare (a system column such as `id`), or a
 * field of a type this list does not know, is not judged here: `unknown`
 * leaves it to the query as before.
 */

/** How a `min`/`max` over a field is answered. */
export type MinMaxKind = 'number' | 'date' | 'date-time' | 'refused' | 'unknown'

interface FieldLike {
  readonly name: string
  readonly type: string
}

interface TableLike {
  readonly name: string
  readonly fields: readonly FieldLike[]
}

interface AppLike {
  readonly tables?: readonly TableLike[]
}

const NUMBER_TYPES: ReadonlySet<string> = new Set([
  'integer',
  'decimal',
  'number',
  'currency',
  'percentage',
  'progress',
  'rating',
  'duration',
  'autonumber',
  'count',
  'rollup',
  // A formula's result type is free text; its value is left to the query.
  'formula',
])

const DATE_TYPES: ReadonlySet<string> = new Set(['date'])

const DATE_TIME_TYPES: ReadonlySet<string> = new Set([
  'datetime',
  'created-at',
  'updated-at',
  'deleted-at',
])

/**
 * The field types with no order a `min`/`max` could mean: text, choices, flags,
 * people, files, structured values and keys. A type named nowhere here or
 * above (a custom one) is left to the query, as an undeclared name is.
 */
const UNORDERED_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'email',
  'url',
  'phone-number',
  'code',
  'color',
  'barcode',
  'time',
  'checkbox',
  'single-select',
  'multi-select',
  'status',
  'user',
  'created-by',
  'updated-by',
  'deleted-by',
  'relationship',
  'single-attachment',
  'multiple-attachments',
  'json',
  'array',
  'geolocation',
  'button',
  'ai-categorize',
  'ai-extract',
  'ai-generate',
  'ai-sentiment',
  'ai-summary',
  'ai-tag',
  'ai-translate',
])

/** The kind a field type orders as on its own; `undefined` for a lookup. */
const kindOfType = (type: string): MinMaxKind | undefined => {
  if (NUMBER_TYPES.has(type)) return 'number'
  if (DATE_TYPES.has(type)) return 'date'
  if (DATE_TIME_TYPES.has(type)) return 'date-time'
  if (UNORDERED_TYPES.has(type)) return 'refused'
  return type === 'lookup' ? undefined : 'unknown'
}

/** A relationship reaches ONE record from this side (many-to-one, one-to-one). */
const reachesOne = (relationship: FieldLike): boolean => {
  const { relationType } = relationship as { readonly relationType?: unknown }
  return (
    relationType === undefined || relationType === 'many-to-one' || relationType === 'one-to-one'
  )
}

/** The kind of the field a lookup copies, or `refused` when it joins many. */
const lookupKind = (
  app: AppLike,
  table: TableLike,
  lookup: FieldLike,
  depth: number
): MinMaxKind => {
  const { relationshipField, relatedField } = lookup as {
    readonly relationshipField?: unknown
    readonly relatedField?: unknown
  }
  const relationship = table.fields.find((field) => field.name === relationshipField)
  // A lookup through a related table's link back reads many records.
  if (relationship?.type !== 'relationship' || !reachesOne(relationship)) return 'refused'
  const { relatedTable } = relationship as { readonly relatedTable?: unknown }
  return minMaxKindAt(app, String(relatedTable), String(relatedField), depth + 1)
}

const minMaxKindAt = (
  app: AppLike,
  tableName: string,
  fieldName: string,
  depth: number
): MinMaxKind => {
  const table = app.tables?.find((t) => t.name === tableName)
  const field = table?.fields.find((f) => f.name === fieldName)
  if (table === undefined || field === undefined) return depth === 0 ? 'unknown' : 'refused'
  const own = kindOfType(field.type)
  if (own !== undefined) return own
  // A chain of lookups deeper than any real config is not followed.
  return depth < 8 ? lookupKind(app, table, field, depth) : 'unknown'
}

/** How a `min`/`max` over `fieldName` of `tableName` is answered. */
export const minMaxKindOf = (app: AppLike, tableName: string, fieldName: string): MinMaxKind =>
  minMaxKindAt(app, tableName, fieldName, 0)

/**
 * A `min`/`max` answer in the field's own form: a `date` as `YYYY-MM-DD`,
 * however the database returned it (a driver hands a date back as a
 * UTC-midnight timestamp). Anything else is returned as it is.
 */
export const asMinMaxAnswer = (kind: MinMaxKind, value: number | string): number | string =>
  kind === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
    ? value.slice(0, 10)
    : value

/** Whether a rollup field is a `MIN`/`MAX` over a `date` of its related table. */
const isMinMaxRollupOverDate = (app: AppLike, table: TableLike, rollup: FieldLike): boolean => {
  const { aggregation, relationshipField, relatedField } = rollup as {
    readonly aggregation?: unknown
    readonly relationshipField?: unknown
    readonly relatedField?: unknown
  }
  if (typeof aggregation !== 'string' || !/^(min|max)$/i.test(aggregation)) return false
  const relationship = table.fields.find((f) => f.name === relationshipField)
  const { relatedTable } = (relationship ?? {}) as { readonly relatedTable?: unknown }
  return (
    typeof relatedTable === 'string' &&
    typeof relatedField === 'string' &&
    minMaxKindOf(app, relatedTable, relatedField) === 'date'
  )
}

/**
 * Whether a field's value is a DAY — a `date` field, a formula whose result is
 * a date, or a `MIN`/`MAX` rollup over a date. PostgreSQL decodes both to a UTC-midnight instant; the records API
 * reads them as `YYYY-MM-DD`, as SQLite stores them.
 */
export const readsAsDay = (app: AppLike, tableName: string, fieldName: string): boolean => {
  const table = app.tables?.find((t) => t.name === tableName)
  const field = table?.fields.find((f) => f.name === fieldName)
  if (table === undefined || field === undefined) return false
  if (field.type === 'date') return true
  // A formula whose result is a date (`CAST(starts_at AS DATE)`) is a day too.
  if (field.type === 'formula')
    return (field as { readonly resultType?: unknown }).resultType === 'date'
  return field.type === 'rollup' && isMinMaxRollupOverDate(app, table, field)
}
