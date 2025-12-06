/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CurrencyField } from '@/domain/models/app/table/field-types/currency-field'
import type { DateField } from '@/domain/models/app/table/field-types/date-field'
import type { DurationField } from '@/domain/models/app/table/field-types/duration-field'
import type { Table } from '@/domain/models/app/tables'
import type React from 'react'

/**
 * Currency symbol map (ISO 4217)
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: '$',
  AUD: '$',
  CHF: 'CHF',
  CNY: '¥',
  INR: '₹',
}

/**
 * Format currency value with symbol position, precision, negative format, and thousands separator
 */
function formatCurrency(
  value: number,
  options: {
    readonly currencyCode: string
    readonly symbolPosition?: 'before' | 'after'
    readonly precision?: number
    readonly negativeFormat?: 'minus' | 'parentheses'
    readonly thousandsSeparator?: 'comma' | 'period' | 'space' | 'none'
  }
): string {
  const {
    currencyCode,
    symbolPosition = 'before',
    precision = 2,
    negativeFormat = 'minus',
    thousandsSeparator = 'none',
  } = options
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode
  const absValue = Math.abs(value)
  const fixedValue = absValue.toFixed(precision)
  const isNegative = value < 0

  // Apply thousands separator
  const formattedValue =
    thousandsSeparator !== 'none'
      ? applyThousandsSeparator(fixedValue, thousandsSeparator)
      : fixedValue

  const result =
    symbolPosition === 'after' ? `${formattedValue}${symbol}` : `${symbol}${formattedValue}`

  // Apply negative format
  return isNegative ? (negativeFormat === 'parentheses' ? `(${result})` : `-${result}`) : result
}

/**
 * Apply thousands separator to a numeric string
 *
 * @param value - Numeric string with period as decimal separator (e.g., "1000000.00")
 * @param separator - Type of thousands separator to use
 * @returns Formatted string with thousands separator applied
 *
 * @example
 * applyThousandsSeparator("1000000.00", "space") // "1 000 000.00"
 * applyThousandsSeparator("1000000.00", "comma") // "1,000,000.00"
 * applyThousandsSeparator("1000000.00", "period") // "1.000.000,00"
 */
function applyThousandsSeparator(value: string, separator: 'comma' | 'period' | 'space'): string {
  // Split on period (decimal separator)
  const parts = value.split('.')
  const integerPart = parts[0] || '0'
  const decimalPart = parts[1]

  // Map separator type to character
  const separatorChar = separator === 'comma' ? ',' : separator === 'period' ? '.' : ' '

  // Insert separator every 3 digits from right to left
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separatorChar)

  // When using period as thousands separator, use comma as decimal separator (European format)
  const decimalSeparator = separator === 'period' ? ',' : '.'

  // Reconstruct with appropriate decimal separator
  return decimalPart !== undefined
    ? `${formattedInteger}${decimalSeparator}${decimalPart}`
    : formattedInteger
}

/**
 * Format date value based on dateFormat option
 *
 * @param dateString - ISO date string (YYYY-MM-DD)
 * @param dateFormat - Date format preset (US, European, or ISO)
 * @returns Formatted date string
 *
 * @example
 * formatDate("2024-06-15", "US") // "6/15/2024"
 * formatDate("2024-06-15", "European") // "15/6/2024"
 * formatDate("2024-06-15", "ISO") // "2024-06-15"
 */
function formatDate(dateString: string, dateFormat?: 'US' | 'European' | 'ISO'): string {
  // Parse ISO date string (YYYY-MM-DD)
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return dateString // Return as-is if not in expected format
  }

  const [, year, month, day] = match

  // Remove leading zeros from month and day
  const monthNum = parseInt(month || '1', 10)
  const dayNum = parseInt(day || '1', 10)

  switch (dateFormat) {
    case 'US':
      return `${monthNum}/${dayNum}/${year}`
    case 'European':
      return `${dayNum}/${monthNum}/${year}`
    case 'ISO':
    default:
      return dateString
  }
}

/**
 * Format datetime value with time format option
 *
 * @param datetimeString - ISO datetime string (YYYY-MM-DD HH:MM:SS)
 * @param timeFormat - Time format (12-hour or 24-hour)
 * @returns Formatted datetime string with time
 *
 * @example
 * formatDateTime("2024-06-15 14:30:00", "24-hour") // "14:30"
 * formatDateTime("2024-06-15 14:30:00", "12-hour") // "2:30 PM"
 */
function formatDateTime(datetimeString: string, timeFormat?: '12-hour' | '24-hour'): string {
  // Parse ISO datetime string (YYYY-MM-DD HH:MM:SS)
  const match = datetimeString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) {
    return datetimeString // Return as-is if not in expected format
  }

  const [, , , , hour, minute] = match
  const hourNum = parseInt(hour || '0', 10)
  const minuteStr = minute || '00'

  if (timeFormat === '12-hour') {
    // Convert to 12-hour format with AM/PM
    const period = hourNum >= 12 ? 'PM' : 'AM'
    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum
    return `${hour12}:${minuteStr} ${period}`
  }

  // Default to 24-hour format
  return `${hour}:${minuteStr}`
}

/**
 * Format duration value with display format option
 *
 * @param durationString - PostgreSQL interval string (e.g., "01:30:45")
 * @param displayFormat - Display format preset (h:mm:ss, h:mm, or decimal)
 * @returns Formatted duration string
 *
 * @example
 * formatDuration("01:30:45", "h:mm:ss") // "1:30:45"
 * formatDuration("01:30:00", "h:mm") // "1:30"
 * formatDuration("01:30:45", "decimal") // "1.5125"
 */
function formatDuration(
  durationString: string,
  displayFormat?: 'h:mm' | 'h:mm:ss' | 'decimal'
): string {
  // Parse PostgreSQL interval format (H:MM:SS or HH:MM:SS)
  const match = durationString.match(/^(\d{1,2}):(\d{2}):(\d{2})/)
  if (!match) {
    return durationString // Return as-is if not in expected format
  }

  const [, hours, minutes, seconds] = match
  const hoursNum = parseInt(hours || '0', 10)
  const minutesNum = parseInt(minutes || '0', 10)
  const secondsNum = parseInt(seconds || '0', 10)

  // Format based on displayFormat
  switch (displayFormat) {
    case 'h:mm:ss':
      return `${hoursNum}:${minutes}:${seconds}`
    case 'h:mm':
      return `${hoursNum}:${minutes}`
    case 'decimal': {
      const totalHours = hoursNum + minutesNum / 60 + secondsNum / 3600
      return String(totalHours)
    }
    default:
      return durationString
  }
}

export interface TableViewProps {
  readonly table: Table
  readonly records: readonly Record<string, unknown>[]
}

/**
 * Format a single cell value based on field type
 *
 * @param field - Field definition with type and formatting options
 * @param value - Cell value to format
 * @returns Formatted cell content as string
 */
/* eslint-disable complexity -- Switch-like field type formatting requires multiple branches */
function formatCellValue(field: Table['fields'][number], value: unknown): string {
  // Format currency fields
  if (field.type === 'currency') {
    const currencyField = field as CurrencyField
    const numericValue = typeof value === 'number' ? value : parseFloat(String(value || 0))
    return formatCurrency(numericValue, {
      currencyCode: currencyField.currency,
      symbolPosition: currencyField.symbolPosition,
      precision: currencyField.precision,
      negativeFormat: currencyField.negativeFormat,
      thousandsSeparator: currencyField.thousandsSeparator,
    })
  }

  // Format date fields
  if (field.type === 'date') {
    const dateField = field as DateField
    const dateString = String(value ?? '')
    return formatDate(dateString, dateField.dateFormat)
  }

  // Format datetime fields
  if (field.type === 'datetime') {
    const dateField = field as DateField
    const datetimeString = String(value ?? '')
    return formatDateTime(datetimeString, dateField.timeFormat)
  }

  // Format duration fields
  if (field.type === 'duration') {
    const durationField = field as DurationField
    const durationString = String(value ?? '')
    return formatDuration(durationString, durationField.displayFormat)
  }

  // Default: display as string
  return String(value ?? '')
}

/**
 * Table View Component
 *
 * Displays table records with proper field formatting
 */
export function TableView({ table, records }: TableViewProps): React.JSX.Element {
  return (
    <div className="table-view">
      <h1>{table.name}</h1>
      <table>
        <thead>
          <tr>
            {table.fields.map((field) => (
              <th key={field.id}>{field.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record, rowIndex) => (
            <tr key={rowIndex}>
              {table.fields.map((field) => (
                <td
                  key={field.id}
                  data-field={field.name}
                >
                  {formatCellValue(field, record[field.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
