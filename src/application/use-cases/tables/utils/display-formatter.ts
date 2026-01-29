/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { CurrencyField } from '@/domain/models/app/table/field-types/currency-field'
import type { DateField } from '@/domain/models/app/table/field-types/date-field'
import type { DurationField } from '@/domain/models/app/table/field-types/duration-field'

/**
 * Currency symbols mapping
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: '$',
  AUD: '$',
}

type ThousandsSeparator = 'comma' | 'period' | 'space' | 'none'
type NegativeFormat = 'minus' | 'parentheses'

/**
 * Get the character used for thousands separation
 */
function getThousandsSeparatorChar(separator: ThousandsSeparator): string {
  const separatorMap: Record<ThousandsSeparator, string> = {
    comma: ',',
    period: '.',
    space: ' ',
    none: '',
  }
  return separatorMap[separator]
}

/**
 * Get the character used for decimal separation based on thousands separator
 */
function getDecimalSeparator(thousandsSeparator: ThousandsSeparator): string {
  // Use comma as decimal separator when period is used for thousands (European format)
  return thousandsSeparator === 'period' ? ',' : '.'
}

/**
 * Apply negative formatting to a formatted amount
 */
function applyNegativeFormat(amount: string, isNegative: boolean, format: NegativeFormat): string {
  if (!isNegative) return amount
  return format === 'parentheses' ? `(${amount})` : `-${amount}`
}

/**
 * Get default thousands separator based on precision
 * When precision is 0 (e.g., JPY), default to no separator (¥1000 not ¥1,000)
 */
function getDefaultThousandsSeparator(precision: number): ThousandsSeparator {
  return precision === 0 ? 'none' : 'comma'
}

/**
 * Format a currency value with the appropriate symbol and formatting options
 *
 * @param value - The numeric value to format
 * @param field - The currency field configuration
 * @returns Formatted currency string
 */
function formatCurrency(value: number, field: CurrencyField): string {
  const symbol = CURRENCY_SYMBOLS[field.currency] || field.currency
  const precision = field.precision ?? 2
  const symbolPosition = field.symbolPosition ?? 'before'
  const negativeFormat = (field.negativeFormat ?? 'minus') as NegativeFormat
  const thousandsSeparator = (field.thousandsSeparator ??
    getDefaultThousandsSeparator(precision)) as ThousandsSeparator

  // Handle negative values
  const isNegative = value < 0
  const absoluteValue = Math.abs(value)

  // Format the number with precision
  const formattedNumber = absoluteValue.toFixed(precision)
  const [integerPartRaw, decimalPart] = formattedNumber.split('.')
  const integerPartBase = integerPartRaw ?? '0'

  // Apply thousands separator
  const separatorChar = getThousandsSeparatorChar(thousandsSeparator)
  const integerPart =
    separatorChar !== ''
      ? integerPartBase.replace(/\B(?=(\d{3})+(?!\d))/g, separatorChar)
      : integerPartBase

  // Reconstruct number with decimal separator
  const decimalSeparator = getDecimalSeparator(thousandsSeparator)
  const reconstructedNumber =
    precision > 0 ? `${integerPart}${decimalSeparator}${decimalPart}` : integerPart

  // Apply symbol position
  const amountWithSymbol =
    symbolPosition === 'before'
      ? `${symbol}${reconstructedNumber}`
      : `${reconstructedNumber}${symbol}`

  return applyNegativeFormat(amountWithSymbol, isNegative, negativeFormat)
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
 * Format a date value based on the date format configuration
 */
function formatDate(value: unknown, field: DateField, timezoneOverride?: string): string {
  const date =
    value instanceof Date ? value : typeof value === 'string' ? new Date(value) : new Date()

  if (isNaN(date.getTime())) {
    return ''
  }

  const timezone = timezoneOverride || field.timeZone
  const targetDate = convertToTimezone(date, timezone)

  const year = targetDate.getFullYear()
  const month = targetDate.getMonth() + 1
  const day = targetDate.getDate()

  const dateFormat = field.dateFormat ?? 'US'
  const formattedDate = formatDatePart(year, month, day, dateFormat)

  const shouldIncludeTime = field.includeTime || field.type === 'datetime'
  if (shouldIncludeTime) {
    const hours = targetDate.getHours()
    const minutes = targetDate.getMinutes()
    const timeFormat = field.timeFormat ?? '24-hour'
    const formattedTime = formatTimePart(hours, minutes, timeFormat)
    return `${formattedDate} ${formattedTime}`
  }

  return formattedDate
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
  field: DateField,
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
  field: DateField,
  timezoneOverride?: string
): FormatResult | undefined {
  const displayValue = formatDateField(value, field, timezoneOverride)
  if (displayValue === undefined) return undefined

  // Include timezone metadata
  return {
    displayValue,
    ...(field.timeZone ? { timezone: field.timeZone } : {}),
    ...(timezoneOverride ? { displayTimezone: timezoneOverride } : {}),
  }
}

/**
 * Parse PostgreSQL interval string to total minutes
 *
 * Handles formats like:
 * - "1 hour 30 minutes"
 * - "2 hours"
 * - "45 minutes"
 * - "1:30:45" (h:mm:ss format)
 *
 * @param value - PostgreSQL interval string
 * @returns Total minutes
 */
function parseIntervalToMinutes(value: string): number {
  // Handle h:mm:ss format (e.g., "1:30:45")
  if (/^\d+:\d{2}(:\d{2})?$/.test(value)) {
    const parts = value.split(':')
    const hours = parseInt(parts[0] ?? '0', 10)
    const minutes = parseInt(parts[1] ?? '0', 10)
    const seconds = parseInt(parts[2] ?? '0', 10)
    return hours * 60 + minutes + seconds / 60
  }

  // Handle PostgreSQL text format (e.g., "1 hour 30 minutes")
  // Extract hours
  const hoursMatch = value.match(/(\d+)\s*hours?/)
  const hoursMinutes = hoursMatch ? parseInt(hoursMatch[1] ?? '0', 10) * 60 : 0

  // Extract minutes
  const minutesMatch = value.match(/(\d+)\s*minutes?/)
  const minutesValue = minutesMatch ? parseInt(minutesMatch[1] ?? '0', 10) : 0

  return hoursMinutes + minutesValue
}

/**
 * Format duration value based on display format
 *
 * @param value - Duration value (string or number)
 * @param field - Duration field configuration
 * @returns Formatted duration string
 */
function formatDuration(value: unknown, field: DurationField): string {
  // Parse the duration value to minutes
  const totalMinutes = typeof value === 'string' ? parseIntervalToMinutes(value) : (value as number)

  const displayFormat = field.displayFormat ?? 'h:mm'

  // Format based on display format
  if (displayFormat === 'h:mm') {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)
    return `${hours}:${String(minutes).padStart(2, '0')}`
  }

  if (displayFormat === 'h:mm:ss') {
    const hours = Math.floor(totalMinutes / 60)
    const remainingMinutes = totalMinutes % 60
    const minutes = Math.floor(remainingMinutes)
    const seconds = Math.floor((remainingMinutes - minutes) * 60)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  if (displayFormat === 'decimal') {
    const hours = totalMinutes / 60
    return hours.toFixed(1)
  }

  // Default to h:mm
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.floor(totalMinutes % 60)
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

/**
 * Format duration field value
 */
function formatDurationField(value: unknown, field: DurationField): string | undefined {
  if (value === null || value === undefined) return undefined
  return formatDuration(value, field)
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
 * Format attachment field and create FormatResult with allowedFileTypes, maxFileSize, and maxFileSizeDisplay
 */
function formatAttachmentFieldResult(
  value: unknown,
  field: Readonly<{ allowedFileTypes?: readonly string[]; maxFileSize?: number }>
): FormatResult | undefined {
  // Only format if we have metadata to add
  if (!field.allowedFileTypes && !field.maxFileSize) return undefined

  return {
    displayValue: String(value ?? ''),
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

  // Format based on field type
  if (field.type === 'currency') {
    return formatCurrencyFieldResult(value, field as CurrencyField)
  }

  if (isDateRelatedType(field.type)) {
    return formatDateFieldResult(value, field as DateField, timezoneOverride)
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
