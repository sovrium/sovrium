/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type {
  CurrencyField,
  DateField,
  DateTimeField,
  DurationField,
  TimeField,
} from '@/domain/models/app/tables/fields/field-types'

type DateRelatedField = DateField | DateTimeField | TimeField

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

function getThousandsSeparatorChar(separator: ThousandsSeparator): string {
  const separatorMap: Record<ThousandsSeparator, string> = {
    comma: ',',
    period: '.',
    space: ' ',
    none: '',
  }
  return separatorMap[separator]
}

function getDecimalSeparator(thousandsSeparator: ThousandsSeparator): string {
  return thousandsSeparator === 'period' ? ',' : '.'
}

function applyNegativeFormat(amount: string, isNegative: boolean, format: NegativeFormat): string {
  if (!isNegative) return amount
  return format === 'parentheses' ? `(${amount})` : `-${amount}`
}

function getDefaultThousandsSeparator(precision: number): ThousandsSeparator {
  return precision === 0 ? 'none' : 'comma'
}

function formatCurrency(value: number, field: CurrencyField): string {
  const symbol = CURRENCY_SYMBOLS[field.currency] || field.currency
  const precision = field.precision ?? 2
  const symbolPosition = field.symbolPosition ?? 'before'
  const negativeFormat = (field.negativeFormat ?? 'minus') as NegativeFormat
  const thousandsSeparator = (field.thousandsSeparator ??
    getDefaultThousandsSeparator(precision)) as ThousandsSeparator

  const isNegative = value < 0
  const absoluteValue = Math.abs(value)

  const formattedNumber = absoluteValue.toFixed(precision)
  const [integerPartRaw, decimalPart] = formattedNumber.split('.')
  const integerPartBase = integerPartRaw ?? '0'

  const separatorChar = getThousandsSeparatorChar(thousandsSeparator)
  const integerPart =
    separatorChar !== ''
      ? integerPartBase.replace(/\B(?=(\d{3})+(?!\d))/g, separatorChar)
      : integerPartBase

  const decimalSeparator = getDecimalSeparator(thousandsSeparator)
  const reconstructedNumber =
    precision > 0 ? `${integerPart}${decimalSeparator}${decimalPart}` : integerPart

  const amountWithSymbol =
    symbolPosition === 'before'
      ? `${symbol}${reconstructedNumber}`
      : `${reconstructedNumber}${symbol}`

  return applyNegativeFormat(amountWithSymbol, isNegative, negativeFormat)
}

function extractPartValue(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

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

function formatDatePart(year: number, month: number, day: number, dateFormat: string): string {
  const formatMap: Record<string, string> = {
    US: `${month}/${day}/${year}`,
    European: `${day}/${month}/${year}`,
    ISO: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  }
  return formatMap[dateFormat] ?? `${month}/${day}/${year}`
}

function formatTimePart(hours: number, minutes: number, timeFormat: string): string {
  if (timeFormat === '12-hour') {
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`
  }
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

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

function formatCurrencyField(value: unknown, field: CurrencyField): string | undefined {
  const numericValue = typeof value === 'string' ? parseFloat(value) : (value as number)
  if (typeof numericValue === 'number' && !isNaN(numericValue)) {
    return formatCurrency(numericValue, field)
  }
  return undefined
}

function formatDateField(
  value: unknown,
  field: DateRelatedField,
  timezoneOverride?: string
): string | undefined {
  return formatDate(value, field, timezoneOverride)
}

export interface FormatResult {
  readonly displayValue: string
  readonly timezone?: string
  readonly displayTimezone?: string
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly maxFileSizeDisplay?: string
}

function formatCurrencyFieldResult(value: unknown, field: CurrencyField): FormatResult | undefined {
  const displayValue = formatCurrencyField(value, field)
  return displayValue !== undefined ? { displayValue } : undefined
}

function formatDateFieldResult(
  value: unknown,
  field: DateRelatedField,
  timezoneOverride?: string
): FormatResult | undefined {
  const displayValue = formatDateField(value, field, timezoneOverride)
  if (displayValue === undefined) return undefined

  return {
    displayValue,
    ...(field.type !== 'time' && field.timeZone ? { timezone: field.timeZone } : {}),
    ...(timezoneOverride ? { displayTimezone: timezoneOverride } : {}),
  }
}

function parseIntervalToMinutes(value: string): number {
  if (/^\d+:\d{2}(:\d{2})?$/.test(value)) {
    const parts = value.split(':')
    const hours = parseInt(parts[0] ?? '0', 10)
    const minutes = parseInt(parts[1] ?? '0', 10)
    const seconds = parseInt(parts[2] ?? '0', 10)
    return hours * 60 + minutes + seconds / 60
  }

  const hoursMatch = value.match(/(\d+)\s*hours?/)
  const hoursMinutes = hoursMatch ? parseInt(hoursMatch[1] ?? '0', 10) * 60 : 0

  const minutesMatch = value.match(/(\d+)\s*minutes?/)
  const minutesValue = minutesMatch ? parseInt(minutesMatch[1] ?? '0', 10) : 0

  return hoursMinutes + minutesValue
}

function formatDuration(value: unknown, field: DurationField): string {
  const totalMinutes = typeof value === 'string' ? parseIntervalToMinutes(value) : (value as number)

  const displayFormat = field.displayFormat ?? 'h:mm'

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

  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.floor(totalMinutes % 60)
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

function formatDurationField(value: unknown, field: DurationField): string | undefined {
  if (value === null || value === undefined) return undefined
  return formatDuration(value, field)
}

function formatDurationFieldResult(value: unknown, field: DurationField): FormatResult | undefined {
  const displayValue = formatDurationField(value, field)
  return displayValue !== undefined ? { displayValue } : undefined
}

function isDateRelatedType(type: string): boolean {
  return type === 'date' || type === 'datetime' || type === 'time'
}

function isAttachmentType(type: string): boolean {
  return type === 'single-attachment' || type === 'multiple-attachments'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  const value = bytes / Math.pow(k, i)
  const formatted = i >= 2 ? Math.round(value) : Math.round(value * 10) / 10

  return `${formatted} ${sizes[i]}`
}

function formatAttachmentFieldResult(
  value: unknown,
  field: Readonly<{ allowedFileTypes?: readonly string[]; maxFileSize?: number }>
): FormatResult | undefined {
  if (!field.allowedFileTypes && !field.maxFileSize) return undefined

  return {
    displayValue: String(value ?? ''),
    ...(field.allowedFileTypes ? { allowedFileTypes: field.allowedFileTypes } : {}),
    ...(field.maxFileSize !== undefined
      ? { maxFileSize: field.maxFileSize, maxFileSizeDisplay: formatBytes(field.maxFileSize) }
      : {}),
  }
}

export interface FormatFieldOptions {
  readonly fieldName: string
  readonly value: unknown
  readonly app: App
  readonly tableName: string
  readonly timezoneOverride?: string
}

export function formatFieldForDisplay(options: FormatFieldOptions): FormatResult | undefined {
  const { fieldName, value, app, tableName, timezoneOverride } = options

  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return undefined

  const field = table.fields.find((f) => f.name === fieldName)
  if (!field) return undefined

  if (field.type === 'currency') {
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

  return undefined
}
