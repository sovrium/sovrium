/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { formatCurrencyValue, type CurrencyDisplayOptions } from '@/domain/utils/currency-format'
import { formatDurationValue } from '@/domain/utils/duration-format'
import type { App } from '@/domain/models/app'
import type {
  CurrencyField,
  DateField,
  DateTimeField,
  DurationField,
  TimeField,
} from '@/domain/models/app/tables/fields/field-types'

type DateRelatedField = DateField | DateTimeField | TimeField

/**
 * Format a currency value with the appropriate symbol and formatting options.
 *
 * The arithmetic lives in `@/domain/utils/currency-format` so the data-table's
 * `format: 'currency'` column renders identically to this `?format=display`
 * path — the grid used to hard-code `$` and `en-US`, which made a field
 * declaring `currency: 'EUR'` render `$0.35`.
 *
 * @param value - The numeric value to format
 * @param field - The currency field configuration
 * @returns Formatted currency string
 */
function formatCurrency(value: number, field: CurrencyField): string {
  return formatCurrencyValue(value, field as CurrencyDisplayOptions)
}

/**
 * Extract date part value from formatter parts
 */
function extractPartValue(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

/**
 * Create date from timezone-converted parts
 */
function createDateFromParts(parts: readonly Intl.DateTimeFormatPart[]): Readonly<Date> {
  const year = extractPartValue(parts, 'year')
  const month = extractPartValue(parts, 'month')
  const day = extractPartValue(parts, 'day')
  const hour = extractPartValue(parts, 'hour')
  const minute = extractPartValue(parts, 'minute')

  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10)
  )
}

/**
 * Convert date to target timezone
 */
function convertToTimezone(date: Readonly<Date>, timezone: string): Readonly<Date> {
  if (!timezone || timezone === 'local') {
    return date
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    })

    const parts = formatter.formatToParts(date)
    return createDateFromParts(parts)
  } catch {
    return date
  }
}

/**
 * Format date part based on date format setting
 */
function formatDatePart(year: number, month: number, day: number, dateFormat: string): string {
  const formatMap: Record<string, string> = {
    US: `${month}/${day}/${year}`,
    European: `${day}/${month}/${year}`,
    ISO: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  }
  return formatMap[dateFormat] ?? `${month}/${day}/${year}`
}

/**
 * Format time part based on time format setting
 */
function formatTimePart(hours: number, minutes: number, timeFormat: string): string {
  if (timeFormat === '12-hour') {
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`
  }
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

/**
 * Format a date or datetime value with timezone conversion and optional time
 */
function formatDateOrDateTime(
  date: Readonly<Date>,
  field: DateField | DateTimeField,
  timezoneOverride?: string
): string {
  const timezone = timezoneOverride || field.timeZone || 'local'
  const targetDate = convertToTimezone(date, timezone)

  const dateFormat = field.dateFormat ?? 'US'
  const formattedDate = formatDatePart(
    targetDate.getFullYear(),
    targetDate.getMonth() + 1,
    targetDate.getDate(),
    dateFormat
  )

  const shouldIncludeTime =
    field.type === 'datetime' || (field.type === 'date' && field.includeTime)
  if (!shouldIncludeTime) return formattedDate

  const timeFormat = field.timeFormat ?? '24-hour'
  const formattedTime = formatTimePart(targetDate.getHours(), targetDate.getMinutes(), timeFormat)
  return `${formattedDate} ${formattedTime}`
}

/**
 * Format a date value based on the date format configuration
 */
function formatDate(value: unknown, field: DateRelatedField, timezoneOverride?: string): string {
  const date =
    value instanceof Date ? value : typeof value === 'string' ? new Date(value) : new Date()

  if (isNaN(date.getTime())) return ''

  if (field.type === 'time') {
    const timeFormat = field.timeFormat ?? '24-hour'
    return formatTimePart(date.getHours(), date.getMinutes(), timeFormat)
  }

  return formatDateOrDateTime(date, field, timezoneOverride)
}

/**
 * Format currency field value
 */
function formatCurrencyField(value: unknown, field: CurrencyField): string | undefined {
  const numericValue = typeof value === 'string' ? parseFloat(value) : (value as number)
  if (typeof numericValue === 'number' && !isNaN(numericValue)) {
    return formatCurrency(numericValue, field)
  }
  return undefined
}

/**
 * Format date/datetime/time field value
 */
function formatDateField(
  value: unknown,
  field: DateRelatedField,
  timezoneOverride?: string
): string | undefined {
  return formatDate(value, field, timezoneOverride)
}

/**
 * Formatted display result with optional timezone metadata and attachment metadata
 */
export interface FormatResult {
  readonly displayValue: string
  readonly timezone?: string
  readonly displayTimezone?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly maxFileSizeDisplay?: string
}

/**
 * Whether a field declares an ISO 4217 code — true for every `currency` field
 * (the code is required there) and for any other field type that opts in, which
 * today means `formula`.
 */
function declaresCurrencyCode(field: { readonly type: string }): boolean {
  return typeof (field as { readonly currency?: unknown }).currency === 'string'
}

/**
 * Format a currency field and create FormatResult
 */
function formatCurrencyFieldResult(value: unknown, field: CurrencyField): FormatResult | undefined {
  const displayValue = formatCurrencyField(value, field)
  return displayValue !== undefined ? { displayValue } : undefined
}

/**
 * Format a date field and create FormatResult with optional timezone
 */
function formatDateFieldResult(
  value: unknown,
  field: DateRelatedField,
  timezoneOverride?: string
): FormatResult | undefined {
  const displayValue = formatDateField(value, field, timezoneOverride)
  if (displayValue === undefined) return undefined

  // Include timezone metadata
  return {
    displayValue,
    ...(field.type !== 'time' && field.timeZone ? { timezone: field.timeZone } : {}),
    ...(timezoneOverride ? { displayTimezone: timezoneOverride } : {}),
  }
}

/**
 * Format duration field value.
 *
 * The parsing and rendering live in `@/domain/utils/duration-format`, which
 * reads the stored value as SECONDS on both dialects — Postgres hands back the
 * `INTERVAL` string, SQLite the `INTEGER`. The previous implementation here
 * bound the raw numeric value to `totalMinutes`, so a numeric duration rendered
 * 60x too large on every path the string branch did not cover.
 */
function formatDurationField(value: unknown, field: DurationField): string | undefined {
  if (value === null || value === undefined) return undefined
  return formatDurationValue(value, field.displayFormat)
}

/**
 * Format duration field and create FormatResult
 */
function formatDurationFieldResult(value: unknown, field: DurationField): FormatResult | undefined {
  const displayValue = formatDurationField(value, field)
  return displayValue !== undefined ? { displayValue } : undefined
}

/**
 * Check if field type is a date-related type
 */
function isDateRelatedType(type: string): boolean {
  return type === 'date' || type === 'datetime' || type === 'time'
}

/**
 * Check if field type is an attachment type
 */
function isAttachmentType(type: string): boolean {
  return type === 'single-attachment' || type === 'multiple-attachments'
}

/**
 * Format bytes to human-readable file size string
 *
 * @param bytes - File size in bytes
 * @returns Formatted file size string (e.g., "5 MB", "1.5 GB")
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  // For MB and above, show clean integers (5 MB, not 5.0 MB)
  // For KB, show one decimal place if needed
  const value = bytes / Math.pow(k, i)
  const formatted = i >= 2 ? Math.round(value) : Math.round(value * 10) / 10

  return `${formatted} ${sizes[i]}`
}

/**
 * Render an attachment value as a human-readable label.
 *
 * [internal ref]: the read-path enricher promotes a bare storage key into an
 * object (`{ key, signedUrl, ... }`) and a key list into an array of those, so
 * a plain `String(value)` here degrades to `'[object Object]'`. Prefer the
 * file name the value carries, falling back to the storage key.
 * `[internal ref]` is the guard.
 */
function attachmentDisplayLabel(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(attachmentDisplayLabel).join(', ')
  if (typeof value === 'object') {
    const entry = value as Record<string, unknown>
    const label = [entry['filename'], entry['name'], entry['key'], entry['url']].find(
      (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0
    )
    return label ?? ''
  }
  return String(value)
}

/**
 * Format attachment field and create FormatResult with allowedFileTypes, maxFileSize, and maxFileSizeDisplay
 */
function formatAttachmentFieldResult(
  value: unknown,
  field: Readonly<{ allowedFileTypes?: readonly string[]; maxFileSize?: number }>
): FormatResult | undefined {
  // Only format if we have metadata to add
  if (!field.allowedFileTypes && !field.maxFileSize) return undefined

  return {
    displayValue: attachmentDisplayLabel(value),
    ...(field.allowedFileTypes ? { allowedFileTypes: field.allowedFileTypes } : {}),
    ...(field.maxFileSize !== undefined
      ? { maxFileSize: field.maxFileSize, maxFileSizeDisplay: formatBytes(field.maxFileSize) }
      : {}),
  }
}

/**
 * Options for formatting field display
 */
export interface FormatFieldOptions {
  readonly fieldName: string
  readonly value: unknown
  readonly app: App
  readonly tableName: string
  readonly timezoneOverride?: string
}

/**
 * Format a field value for display based on field type and configuration
 */
export function formatFieldForDisplay(options: FormatFieldOptions): FormatResult | undefined {
  const { fieldName, value, app, tableName, timezoneOverride } = options

  // Find the table and field
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return undefined

  const field = table.fields.find((f) => f.name === fieldName)
  if (!field) return undefined

  // Format based on field type.
  //
  // A DECLARED code counts as much as the `currency` type does: a `formula`
  // computing a monetary amount may now declare `currency`, and the grid honours
  // it (`resolveCurrencyOptions`). Gating this path on the type alone would make
  // the same field render `€` in the grid and go unformatted through
  // `?format=display` — a declared option honoured on one surface only, which is
  // the failure this change exists to remove rather than relocate.
  if (field.type === 'currency' || declaresCurrencyCode(field)) {
    return formatCurrencyFieldResult(value, field as CurrencyField)
  }

  if (isDateRelatedType(field.type)) {
    return formatDateFieldResult(value, field as DateRelatedField, timezoneOverride)
  }

  if (field.type === 'duration') {
    return formatDurationFieldResult(value, field as DurationField)
  }

  if (isAttachmentType(field.type)) {
    return formatAttachmentFieldResult(
      value,
      field as { allowedFileTypes?: readonly string[]; maxFileSize?: number }
    )
  }

  // Return undefined for types that don't need formatting yet
  return undefined
}
