/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatFieldForDisplay, type FormatResult } from './display-formatter'
import type { App } from '@/domain/models/app'

/**
 * Field value types supported by record transformation
 */
export type RecordFieldValue =
  string | number | boolean | readonly unknown[] | Readonly<Record<string, unknown>> | null

/**
 * Formatted field value with optional display formatting
 */
export interface FormattedFieldValue {
  readonly value: RecordFieldValue
  readonly displayValue?: string
  readonly timezone?: string
  readonly displayTimezone?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly maxFileSizeDisplay?: string
}

/**
 * Transformed record structure for API responses (Airtable-style)
 *
 * System fields (id, createdAt, updatedAt, createdBy, updatedBy) are at root level.
 * User-defined fields are nested under the `fields` property.
 */
export interface TransformedRecord {
  readonly id: string | number
  readonly fields: Record<string, RecordFieldValue | FormattedFieldValue>
  readonly createdAt: string
  readonly updatedAt: string
  readonly createdBy?: string
  readonly updatedBy?: string
  readonly deletedBy?: string
}

/**
 * Convert a value to ISO 8601 datetime string
 *
 * @param value - Value to convert (Date object or string)
 * @returns ISO 8601 datetime string
 */
const toISOString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    // Already ISO-8601 (has the date/time `T` separator) → pass through.
    if (value.includes('T')) return value
    // SQLite's `CURRENT_TIMESTAMP` yields a bare UTC "YYYY-MM-DD HH:MM:SS" string
    // (no T/Z/ms) that fails the ISO-8601 response validator. Normalise it while
    // PRESERVING UTC — `new Date("YYYY-MM-DD HH:MM:SS")` would parse as LOCAL time
    // and shift the instant, so append the explicit `T`/`Z` before parsing.
    const normalized = new Date(`${value.replace(' ', 'T')}Z`)
    return Number.isNaN(normalized.getTime()) ? value : normalized.toISOString()
  }
  return new Date().toISOString()
}

/**
 * Numeric field types that should return number values in API responses.
 * PostgreSQL DECIMAL/NUMERIC types are returned as strings by database drivers,
 * so we coerce them to numbers based on the field's schema type.
 *
 * Per the field-value wire-representation contract, `decimal` is
 * DELIBERATELY EXCLUDED from this set: `decimal` is the precision-preserving
 * escape hatch and must round-trip as a STRING on BOTH dialects (mirroring
 * PostgreSQL's own numeric→string driver behavior to avoid binary-float
 * precision loss beyond 2^53). The ergonomic money/ratio types (currency /
 * percentage) stay numbers and ARE coerced here. `decimal` is handled
 * separately by STRING_DECIMAL_FIELD_TYPES below (which stringifies the SQLite
 * NUMERIC-affinity number read-back so it matches Postgres's string form).
 */
const NUMERIC_FIELD_TYPES: ReadonlySet<string> = new Set([
  'currency',
  'number',
  'integer',
  'percentage',
  'percent',
  'rating',
  'duration',
])

/**
 * Single attachment field types that store a single file metadata object.
 * Includes the 'attachment' alias used in tests (maps to JSONB storage).
 */
const SINGLE_ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'attachment',
  'single-attachment',
])

/**
 * Boolean field types whose stored value must be coerced to a JS boolean in
 * API responses.
 *
 * SQLite has no native boolean type — a `checkbox`/`boolean` column maps to
 * `INTEGER` and reads back as `0`/`1`. PostgreSQL returns a real `boolean`.
 * Coercing here makes the records-API response dialect-independent: callers
 * always see `true`/`false`. On PostgreSQL the value is already a boolean, so
 * the coercion is an identity no-op.
 */
const BOOLEAN_FIELD_TYPES: ReadonlySet<string> = new Set(['checkbox', 'boolean', 'bool'])

/**
 * Field types whose value is JSON-serialized as TEXT on SQLite but stored
 * natively (TEXT[] / JSONB) on PostgreSQL.
 *
 * On PostgreSQL these deserialize to a native JS array / object; on SQLite they
 * read back as the raw JSON string (e.g. `'["a","b"]'`). Coercing here makes the
 * records-API response dialect-independent: callers always see a parsed array /
 * object. The coercion is type-guarded (only a `string` value is parsed), so on
 * PostgreSQL — where the value is already an array/object — it is a no-op, which
 * also makes double-application idempotent.
 *
 * `array` belongs here for exactly the same reason `multi-select` does, and its
 * absence was an enumeration omission rather than a decision: the two types are
 * IDENTICAL at every other layer — both compile to `TEXT[]` on PostgreSQL
 * (`sql-type-mappings.ts`), both collapse to `TEXT` holding JSON on SQLite, and
 * both are written through the same `jsonbLiteral` encoder. Only membership of
 * this Set differed, so `multi-select` came back as `['a']` and `array` came
 * back as the string `'["a"]'` on the default engine.
 *
 * `multiple-attachments` is the same omission a second time, and it hid longer
 * because something else was quietly covering for it. It shares every layer with
 * `json` — `JSONB` on PostgreSQL, `TEXT` holding JSON on SQLite
 * (`sql-type-mappings.ts`), same write encoder — so on SQLite it read back as
 * the raw document `'[{"filename":"a.pdf"}]'`. What masked that is
 * `attachment-url-enricher.ts`, which re-parses the cell itself before minting
 * download URLs: a property of the THREE call sites that run it (list, get-one,
 * create — `programs.ts`), not of the field type. PATCH, batch-create and
 * restore do not run the enricher, so the same stored row answered with an array
 * or with a string depending on which verb asked. Membership here fixes the
 * shape at the transformer, which every read path shares.
 */
const JSON_DESERIALIZED_FIELD_TYPES: ReadonlySet<string> = new Set([
  'multi-select',
  'json',
  'array',
  'multiple-attachments',
])

/**
 * The one rollup aggregation whose result is an ARRAY rather than a scalar.
 *
 * `rollup` cannot join {@link JSON_DESERIALIZED_FIELD_TYPES} wholesale — that
 * Set is keyed on field TYPE, and seven of the eight aggregations produce a
 * scalar. Parsing those would be actively destructive rather than merely
 * useless: `JSON.parse` turns a `decimal` SUM read back as the string `'12.50'`
 * into the NUMBER `12.5`, silently undoing the precision-preserving string
 * contract that `stringifyDecimalField` exists to uphold two
 * functions below.
 *
 * So the discriminator is the aggregation, not the type. On SQLite an
 * `ARRAYUNIQUE` rollup is `json_group_array(...)` — TEXT holding JSON — for the
 * same reason `array` and `multi-select` are: the engine has no array type.
 * On PostgreSQL it is a native `text[]` and the parse is a no-op, exactly as it
 * is for the four types above.
 */
const ARRAY_VALUED_ROLLUP_AGGREGATION = 'ARRAYUNIQUE'

/**
 * Field types whose value must round-trip as a STRING on BOTH dialects.
 *
 * PostgreSQL `DECIMAL` deserializes to a precision-preserving string; SQLite
 * `NUMERIC` affinity deserializes to a native JS number. Per the decided
 * contract, raw `decimal` is a string on both dialects (currency /
 * percentage stay numbers — they are handled by NUMERIC_FIELD_TYPES). Coercing here is
 * type-guarded (only a `number` value is stringified), so on PostgreSQL — where
 * the value is already a string — it is a no-op and double-application is
 * idempotent.
 */
const STRING_DECIMAL_FIELD_TYPES: ReadonlySet<string> = new Set(['decimal'])

/**
 * Apply displayName override to an attachment object.
 * When an attachment has a displayName property, the API response uses
 * displayName as the filename, giving callers a user-friendly label
 * without altering the stored filename.
 */
function applyAttachmentDisplayName(value: RecordFieldValue): RecordFieldValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const attachment = value as Record<string, unknown>
  if (!attachment['displayName']) return value
  return { ...attachment, filename: attachment['displayName'] }
}

/**
 * Look up a field's type from the app schema
 */
const getFieldType = (
  app: Readonly<App>,
  tableName: string,
  fieldName: string
): string | undefined => {
  const table = app.tables?.find((t) => t.name === tableName)
  return table?.fields.find((f) => f.name === fieldName)?.type
}

/**
 * Does this field carry JSON-as-TEXT on SQLite and a native array/object on
 * PostgreSQL?
 *
 * Two answers, one question: a member of {@link JSON_DESERIALIZED_FIELD_TYPES},
 * or the single rollup aggregation that yields an array (see
 * {@link ARRAY_VALUED_ROLLUP_AGGREGATION}). Kept as one predicate so the read
 * path has ONE place to ask, rather than the type Set growing a parallel
 * aggregation check at each call site.
 */
const isJsonDeserializedField = (
  app: Readonly<App>,
  tableName: string,
  fieldName: string
): boolean => {
  const field = app.tables
    ?.find((t) => t.name === tableName)
    ?.fields.find((f) => f.name === fieldName)
  if (!field) return false
  if (JSON_DESERIALIZED_FIELD_TYPES.has(field.type)) return true
  return (
    field.type === 'rollup' &&
    'aggregation' in field &&
    typeof field.aggregation === 'string' &&
    field.aggregation.toUpperCase() === ARRAY_VALUED_ROLLUP_AGGREGATION
  )
}

/**
 * Coerce a string value to a number if the field type is numeric.
 * Returns the original value unchanged for non-numeric field types.
 */
const coerceNumericField = (
  fieldName: string,
  value: RecordFieldValue,
  app: Readonly<App>,
  tableName: string
): RecordFieldValue => {
  if (typeof value !== 'string') return value
  const fieldType = getFieldType(app, tableName, fieldName)
  if (!fieldType || !NUMERIC_FIELD_TYPES.has(fieldType)) return value
  const num = Number(value)
  return !isNaN(num) && isFinite(num) ? num : value
}

/**
 * Coerce a checkbox/boolean field value to a JS boolean.
 *
 * Accepts the SQLite `0`/`1` integer representation (and the `'0'`/`'1'` /
 * `'true'`/`'false'` string forms) and normalizes to `true`/`false`. `null`
 * is preserved (an unset boolean). Returns the value unchanged for non-boolean
 * field types — so on PostgreSQL (already a real boolean) this is a no-op.
 */
const coerceBooleanField = (
  fieldName: string,
  value: RecordFieldValue,
  app: Readonly<App>,
  tableName: string
): RecordFieldValue => {
  const fieldType = getFieldType(app, tableName, fieldName)
  if (!fieldType || !BOOLEAN_FIELD_TYPES.has(fieldType)) return value
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true'
  return value
}

/**
 * Deserialize a JSON-as-TEXT field value back to its parsed array/object form.
 *
 * Only applies to the {@link JSON_DESERIALIZED_FIELD_TYPES} field types and only
 * when the value is a string (the SQLite case). On PostgreSQL the value is
 * already a native array/object, so this is a no-op — which also makes
 * double-application idempotent. A string that fails to parse is left unchanged.
 */
const deserializeJsonField = (
  fieldName: string,
  value: RecordFieldValue,
  app: Readonly<App>,
  tableName: string
): RecordFieldValue => {
  if (typeof value !== 'string') return value
  if (!isJsonDeserializedField(app, tableName, fieldName)) return value
  try {
    return JSON.parse(value) as RecordFieldValue
  } catch {
    return value
  }
}

/**
 * Stringify a `decimal` field value to match PostgreSQL's precision-preserving
 * string representation.
 *
 * Only applies to `decimal` field types and only when the value is a number (the
 * SQLite case). On PostgreSQL the value is already a string, so this is a no-op —
 * which also makes double-application idempotent.
 */
const stringifyDecimalField = (
  fieldName: string,
  value: RecordFieldValue,
  app: Readonly<App>,
  tableName: string
): RecordFieldValue => {
  if (typeof value !== 'number') return value
  const fieldType = getFieldType(app, tableName, fieldName)
  if (!fieldType || !STRING_DECIMAL_FIELD_TYPES.has(fieldType)) return value
  return String(value)
}

/**
 * Convert string numbers to numeric values (used in display format path)
 */
const parseNumericString = (value: unknown, processedValue: RecordFieldValue): RecordFieldValue => {
  // Coerce string numbers to numeric values for numeric field types
  if (typeof value === 'string') {
    const num = Number(value)
    return !isNaN(num) && isFinite(num) ? num : processedValue
  }
  return typeof value === 'number' ? value : processedValue
}

/**
 * Build formatted field value with optional metadata
 */
function buildFormattedValue(
  fieldValue: RecordFieldValue,
  formatResult: Readonly<FormatResult>
): FormattedFieldValue {
  const base: FormattedFieldValue = {
    value: fieldValue,
    displayValue: formatResult.displayValue,
  }

  return {
    ...base,
    ...(formatResult.timezone ? { timezone: formatResult.timezone } : {}),
    ...(formatResult.displayTimezone ? { displayTimezone: formatResult.displayTimezone } : {}),
    ...(formatResult.allowedFileTypes ? { allowedFileTypes: formatResult.allowedFileTypes } : {}),
    ...(formatResult.maxFileSize !== undefined ? { maxFileSize: formatResult.maxFileSize } : {}),
    ...(formatResult.maxFileSizeDisplay
      ? { maxFileSizeDisplay: formatResult.maxFileSizeDisplay }
      : {}),
  }
}

/**
 * Apply type-aware coercions for fields without display formatting:
 * - Coerce numeric strings to numbers
 * - Apply displayName override for single attachment fields
 */
function processRawField(
  key: string,
  value: RecordFieldValue,
  app: App,
  tableName: string
): RecordFieldValue {
  const numeric = coerceNumericField(key, value, app, tableName)
  const decimalString = stringifyDecimalField(key, numeric, app, tableName)
  const jsonParsed = deserializeJsonField(key, decimalString, app, tableName)
  const coerced = coerceBooleanField(key, jsonParsed, app, tableName)
  const fieldType = getFieldType(app, tableName, key)
  return fieldType && SINGLE_ATTACHMENT_FIELD_TYPES.has(fieldType)
    ? applyAttachmentDisplayName(coerced)
    : coerced
}

/**
 * Process a single field value with optional display formatting
 */
const processFieldValue = (
  key: string,
  value: unknown,
  options?: Readonly<{
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }>
): Readonly<RecordFieldValue | FormattedFieldValue> => {
  const processedValue = value instanceof Date ? value.toISOString() : (value as RecordFieldValue)

  // Check if app schema info is available for type-aware processing
  const hasSchemaInfo = options?.app && options?.tableName

  // Apply display formatting if requested
  if (options?.format !== 'display' || !hasSchemaInfo) {
    return hasSchemaInfo
      ? processRawField(key, processedValue, options.app!, options.tableName!)
      : processedValue
  }

  // For display formatting, pass the original value (may be string or number from database)
  const formatResult = formatFieldForDisplay({
    fieldName: key,
    value,
    app: options.app!,
    tableName: options.tableName!,
    timezoneOverride: options.timezone,
  })

  if (formatResult === undefined) {
    return processedValue
  }

  // For formatted fields, use the original value (preserve number type)
  const fieldValue = parseNumericString(value, processedValue)

  return buildFormattedValue(fieldValue, formatResult)
}

/**
 * Check if a field is defined in the table schema
 */
const isTableField = (
  fieldName: string,
  app: Readonly<App> | undefined,
  tableName: string | undefined
): boolean => {
  if (!app || !tableName) return false
  const table = app.tables?.find((t) => t.name === tableName)
  return Boolean(table?.fields.some((f) => f.name === fieldName))
}

/**
 * Build fields object including created_at/updated_at if they're defined as table fields
 */
const buildFieldsObject = (
  userFields: Readonly<Record<string, unknown>>,
  createdAt: unknown,
  updatedAt: unknown,
  options?: {
    readonly app?: App
    readonly tableName?: string
  }
): Readonly<Record<string, unknown>> => {
  const hasCreatedAtField = isTableField('created_at', options?.app, options?.tableName)
  const hasUpdatedAtField = isTableField('updated_at', options?.app, options?.tableName)

  return {
    ...userFields,
    ...(hasCreatedAtField && createdAt !== undefined ? { created_at: createdAt } : {}),
    ...(hasUpdatedAtField && updatedAt !== undefined ? { updated_at: updatedAt } : {}),
  }
}

/**
 * Transform a raw database record into the API response format (Airtable-style)
 *
 * This utility standardizes record transformation across all table endpoints:
 * - Converts id to string
 * - Nests user-defined fields under `fields` property (Airtable-style)
 * - Keeps system fields (id, createdAt, updatedAt) at root level
 * - Normalizes created_at/updated_at to ISO strings (or current timestamp if missing)
 * - Converts Date objects in field values to ISO 8601 strings for API compliance
 * - Optionally applies display formatting when format=display is requested
 *
 * @param record - Raw database record
 * @param options - Transformation options
 * @returns Transformed record for API response
 */
export const transformRecord = (
  record: Readonly<Record<string, unknown>>,
  options?: {
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }
): TransformedRecord => {
  // Extract system fields including authorship metadata
  const {
    id,
    created_at: createdAt,
    updated_at: updatedAt,
    created_by: createdBy,
    updated_by: updatedBy,
    deleted_by: deletedBy,
    ...userFields
  } = record

  // Build user fields, potentially including created_at/updated_at if they're table fields
  const fieldsToTransform = buildFieldsObject(userFields, createdAt, updatedAt, options)

  // Convert Date objects to ISO strings in user fields and optionally format for display
  const transformedFields = Object.entries(fieldsToTransform).reduce<
    Record<string, RecordFieldValue | FormattedFieldValue>
  >(
    (acc, [key, value]) => ({
      ...acc,
      [key]: processFieldValue(key, value, options) as RecordFieldValue | FormattedFieldValue,
    }),
    {}
  )

  return {
    id: String(id),
    fields: transformedFields,
    createdAt: createdAt ? toISOString(createdAt) : new Date().toISOString(),
    updatedAt: updatedAt ? toISOString(updatedAt) : new Date().toISOString(),
    ...(createdBy ? { createdBy: String(createdBy) } : {}),
    ...(updatedBy ? { updatedBy: String(updatedBy) } : {}),
    ...(deletedBy ? { deletedBy: String(deletedBy) } : {}),
  }
}

/**
 * Transform multiple database records into API response format
 *
 * @param records - Array of raw database records
 * @param options - Transformation options
 * @returns Array of transformed records (mutable for API response compatibility)
 */
export const transformRecords = (
  records: readonly Record<string, unknown>[],
  options?: {
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }
): readonly TransformedRecord[] => records.map((record) => transformRecord(record, options))
