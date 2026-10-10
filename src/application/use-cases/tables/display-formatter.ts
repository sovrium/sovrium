/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  formatCurrencyValue,
  type CurrencyDisplayOptions,
} from '@/domain/kernel/format/currency-format'
import { formatDurationValue } from '@/domain/kernel/format/duration-format'
import { withInheritedCurrency } from '@/domain/models/app/tables/rollup-currency-service'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
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
 * path — rather than hard-coding `$` and `en-US`, which would make a field
 * declaring `currency: 'EUR'` render `$0.35`.
 *
 * @param value - The numeric value to format
 * @param field - The currency field configuration
 * @returns Formatted currency string
 */
function formatCurrency(value: number, field: CurrencyField): string {
  return formatCurrencyValue(value, field as CurrencyDisplayOptions)
}

/** Wall-clock parts of an instant in one zone. */
interface ZonedParts {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
}

/**
 * Read the wall-clock parts of `date` in `timezone`.
 *
 * Through `Intl` with an explicit `timeZone`, never through a `Date`'s local
 * getters: those follow POSIX `TZ`, which belongs to the host and is not the
 * operator's choice. `hourCycle: 'h23'` keeps midnight at `0` rather than `24`.
 * An unknown zone falls back to UTC rather than throwing mid-response.
 */
function zonedParts(date: Readonly<Date>, timezone: string): ZonedParts {
  const read = (timeZone: string): readonly Intl.DateTimeFormatPart[] =>
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(date as Date)
  const parts = ((): readonly Intl.DateTimeFormatPart[] => {
    try {
      return read(timezone)
    } catch {
      return read('UTC')
    }
  })()
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)
  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
  }
}

/**
 * The zone a date is rendered in: the request's override, then the field's own
 * zone, then the operator timezone (`SOVRIUM_TIMEZONE`, UTC when unset).
 *
 * A field declaring `timeZone: 'local'` asks the CLIENT to render in its own
 * zone; the server has no client zone, and the process zone is the host's, so
 * the server-side rendering of such a field uses the operator timezone.
 */
function effectiveTimezone(field: DateRelatedField, timezoneOverride: string | undefined): string {
  if (timezoneOverride) return timezoneOverride
  const declared = field.type === 'time' ? undefined : field.timeZone
  if (declared && declared !== 'local') return declared
  return resolveOperatorTimezone()
}

/**
 * Format date part based on date format setting
 */
function formatDatePart(year: number, month: number, day: number, dateFormat: string): string {
  const formatMap: Readonly<Record<string, string>> = {
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
 * Format a date or datetime value in the effective zone, with optional time
 */
function formatDateOrDateTime(
  date: Readonly<Date>,
  field: DateField | DateTimeField,
  timezone: string
): string {
  const parts = zonedParts(date, timezone)

  const dateFormat = field.dateFormat ?? 'US'
  const formattedDate = formatDatePart(parts.year, parts.month, parts.day, dateFormat)

  const shouldIncludeTime =
    field.type === 'datetime' || (field.type === 'date' && field.includeTime)
  if (!shouldIncludeTime) return formattedDate

  const timeFormat = field.timeFormat ?? '24-hour'
  const formattedTime = formatTimePart(parts.hour, parts.minute, timeFormat)
  return `${formattedDate} ${formattedTime}`
}

/**
 * Format a date value based on the date format configuration
 */
function formatDate(value: unknown, field: DateRelatedField, timezone: string): string {
  const date =
    value instanceof Date ? value : typeof value === 'string' ? new Date(value) : new Date()

  if (isNaN(date.getTime())) return ''

  if (field.type === 'time') {
    const timeFormat = field.timeFormat ?? '24-hour'
    const parts = zonedParts(date, timezone)
    return formatTimePart(parts.hour, parts.minute, timeFormat)
  }

  return formatDateOrDateTime(date, field, timezone)
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
  timezone: string
): string | undefined {
  return formatDate(value, field, timezone)
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
  const timezone = effectiveTimezone(field, timezoneOverride)
  const displayValue = formatDateField(value, field, timezone)
  if (displayValue === undefined) return undefined

  // Timezone metadata: `timezone` echoes the field's declared zone, and
  // `displayTimezone` names the zone `displayValue` was actually rendered in.
  return {
    displayValue,
    ...(field.type !== 'time' && field.timeZone ? { timezone: field.timeZone } : {}),
    displayTimezone: timezone,
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
 * The read-path enricher promotes a bare storage key into an
 * object (`{ key, signedUrl, ... }`) and a key list into an array of those, so
 * a plain `String(value)` here degrades to `'[object Object]'`. Prefer the
 * file name the value carries, falling back to the storage key.
 * A buckets signed URLs spec is the guard.
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

  const declared = table.fields.find((f) => f.name === fieldName)
  if (!declared) return undefined
  // A SUM / AVG / MIN / MAX rollup over a `currency` field is money in that
  // field's currency: it carries the source's display keys, its own winning.
  const field = withInheritedCurrency(declared, table, app.tables ?? [])

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
