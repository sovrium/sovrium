/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatFieldForDisplay, type FormatResult } from './display-formatter'
import type { App } from '@/domain/models/app'

export type RecordFieldValue =
  | string
  | number
  | boolean
  | readonly unknown[]
  | Readonly<Record<string, unknown>>
  | null

export interface FormattedFieldValue {
  readonly value: RecordFieldValue
  readonly displayValue?: string
  readonly timezone?: string
  readonly displayTimezone?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly maxFileSizeDisplay?: string
}

export interface TransformedRecord {
  readonly id: string | number
  readonly fields: Record<string, RecordFieldValue | FormattedFieldValue>
  readonly createdAt: string
  readonly updatedAt: string
  readonly createdBy?: string
  readonly updatedBy?: string
  readonly deletedBy?: string
}

const toISOString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'string') {
    return value
  }
  return new Date().toISOString()
}

const NUMERIC_FIELD_TYPES: ReadonlySet<string> = new Set([
  'currency',
  'number',
  'integer',
  'percentage',
  'percent',
  'rating',
  'duration',
])

const SINGLE_ATTACHMENT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'attachment',
  'single-attachment',
])

const BOOLEAN_FIELD_TYPES: ReadonlySet<string> = new Set(['checkbox', 'boolean', 'bool'])

function applyAttachmentDisplayName(value: RecordFieldValue): RecordFieldValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const attachment = value as Record<string, unknown>
  if (!attachment['displayName']) return value
  return { ...attachment, filename: attachment['displayName'] }
}

const getFieldType = (
  app: Readonly<App>,
  tableName: string,
  fieldName: string
): string | undefined => {
  const table = app.tables?.find((t) => t.name === tableName)
  return table?.fields.find((f) => f.name === fieldName)?.type
}

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

const parseNumericString = (value: unknown, processedValue: RecordFieldValue): RecordFieldValue => {
  if (typeof value === 'string') {
    const num = Number(value)
    return !isNaN(num) && isFinite(num) ? num : processedValue
  }
  return typeof value === 'number' ? value : processedValue
}

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

function processRawField(
  key: string,
  value: RecordFieldValue,
  app: App,
  tableName: string
): RecordFieldValue {
  const numeric = coerceNumericField(key, value, app, tableName)
  const coerced = coerceBooleanField(key, numeric, app, tableName)
  const fieldType = getFieldType(app, tableName, key)
  return fieldType && SINGLE_ATTACHMENT_FIELD_TYPES.has(fieldType)
    ? applyAttachmentDisplayName(coerced)
    : coerced
}

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

  const hasSchemaInfo = options?.app && options?.tableName

  if (options?.format !== 'display' || !hasSchemaInfo) {
    return hasSchemaInfo
      ? processRawField(key, processedValue, options.app!, options.tableName!)
      : processedValue
  }

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

  const fieldValue = parseNumericString(value, processedValue)

  return buildFormattedValue(fieldValue, formatResult)
}

const isTableField = (
  fieldName: string,
  app: Readonly<App> | undefined,
  tableName: string | undefined
): boolean => {
  if (!app || !tableName) return false
  const table = app.tables?.find((t) => t.name === tableName)
  return Boolean(table?.fields.some((f) => f.name === fieldName))
}

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

export const transformRecord = (
  record: Readonly<Record<string, unknown>>,
  options?: {
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }
): TransformedRecord => {
  const {
    id,
    created_at: createdAt,
    updated_at: updatedAt,
    created_by: createdBy,
    updated_by: updatedBy,
    deleted_by: deletedBy,
    ...userFields
  } = record

  const fieldsToTransform = buildFieldsObject(userFields, createdAt, updatedAt, options)

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

export const transformRecords = (
  records: readonly Record<string, unknown>[],
  options?: {
    readonly format?: 'display'
    readonly app?: App
    readonly tableName?: string
    readonly timezone?: string
  }
): readonly TransformedRecord[] => records.map((record) => transformRecord(record, options))
