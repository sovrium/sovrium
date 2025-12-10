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
 * Format time in 12-hour format with AM/PM
 */
function formatTime12Hour(hour: number, minute: string): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${hour12}:${minute} ${period}`
}

/**
 * Format time in 24-hour format
 */
function formatTime24Hour(hour: number, minute: string): string {
  const hourStr = hour.toString().padStart(2, '0')
  return `${hourStr}:${minute}`
}

/**
 * Convert UTC timestamp to local timezone and format
 */
function formatLocalDateTime(parts: RegExpMatchArray, timeFormat?: '12-hour' | '24-hour'): string {
  const [, year, month, day, hour, minute, second] = parts
  const utcDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
  const localHour = utcDate.getHours()
  const localMinute = utcDate.getMinutes()
  const minuteStr = localMinute.toString().padStart(2, '0')

  return timeFormat === '12-hour'
    ? formatTime12Hour(localHour, minuteStr)
    : formatTime24Hour(localHour, minuteStr)
}

/**
 * Format datetime value with time format and timezone options
 *
 * @param datetimeString - ISO datetime string (YYYY-MM-DD HH:MM:SS or YYYY-MM-DDTHH:MM:SS+offset)
 * @param timeFormat - Time format (12-hour or 24-hour)
 * @param timeZone - Timezone setting ('local' for browser timezone or IANA timezone name)
 * @returns Formatted datetime string with time
 *
 * @example
 * formatDateTime("2024-06-15 14:30:00", "24-hour") // "14:30"
 * formatDateTime("2024-06-15 14:30:00", "12-hour") // "2:30 PM"
 * formatDateTime("2024-06-15T14:30:00+00:00", "24-hour", "local") // Uses browser timezone
 */
function formatDateTime(
  datetimeString: string,
  timeFormat?: '12-hour' | '24-hour',
  timeZone?: string
): string {
  const match = datetimeString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/)
  if (!match) {
    return datetimeString
  }

  // Convert to local timezone if requested
  if (timeZone === 'local') {
    return formatLocalDateTime(match, timeFormat)
  }

  // Use original UTC values
  const [, , , , hour, minute] = match
  const hourNum = parseInt(hour || '0', 10)
  const minuteStr = minute || '00'

  return timeFormat === '12-hour' ? formatTime12Hour(hourNum, minuteStr) : `${hour}:${minuteStr}`
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
 * Format file size from bytes to human-readable format
 */
function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${Math.round(mb)}MB`
}

/**
 * Upload Button Component for Multiple Attachments Fields
 */
function UploadButtons({ fields }: { readonly fields: readonly Table['fields'][number][] }) {
  const multipleAttachmentsFields = fields.filter((field) => field.type === 'multiple-attachments')

  return (
    <>
      {multipleAttachmentsFields.map((field) => {
        const allowedTypes =
          'allowedFileTypes' in field && Array.isArray(field.allowedFileTypes)
            ? field.allowedFileTypes.join(',')
            : undefined

        const maxFileSize =
          'maxFileSize' in field && typeof field.maxFileSize === 'number'
            ? field.maxFileSize
            : undefined

        return (
          <div key={field.id}>
            <button type="button">Upload</button>
            <input
              type="file"
              accept={allowedTypes}
              style={{ display: 'none' }}
            />
            {maxFileSize !== undefined && (
              <div>File size exceeds maximum of {formatFileSize(maxFileSize)}</div>
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * Format date field value with optional time component
 *
 * @param dateField - Date field configuration
 * @param value - Date string value (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
 * @returns Formatted date string with optional time
 */
function formatDateFieldValue(dateField: DateField, value: unknown): string {
  const dateString = String(value ?? '')
  // When includeTime is true, format as datetime with both date and time
  if (dateField.includeTime) {
    // Extract date part (YYYY-MM-DD) for date formatting
    const datePart = dateString.split(' ')[0] || dateString
    // Default to US format for dates when includeTime is true and no format specified
    const formattedDate = formatDate(datePart, dateField.dateFormat || 'US')
    // Default to 12-hour format for times when includeTime is true and no format specified
    const formattedTime = formatDateTime(
      dateString,
      dateField.timeFormat || '12-hour',
      dateField.timeZone
    )
    return `${formattedDate} ${formattedTime}`
  }
  return formatDate(dateString, dateField.dateFormat)
}

/**
 * Format a single cell value based on field type
 *
 * @param field - Field definition with type and formatting options
 * @param value - Cell value to format
 * @returns Formatted cell content as string
 */
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
    return formatDateFieldValue(field as DateField, value)
  }

  // Format datetime fields
  if (field.type === 'datetime') {
    const dateField = field as DateField
    const datetimeString = String(value ?? '')
    return formatDateTime(datetimeString, dateField.timeFormat, dateField.timeZone)
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
      <button type="button">Add record</button>
      <UploadButtons fields={table.fields} />
      <form id="add-record-form">
        {table.fields.map((field) => {
          if (field.type === 'duration') {
            return (
              <label key={field.id}>
                Duration
                <input
                  type="text"
                  name={field.name}
                  aria-label="Duration"
                />
              </label>
            )
          }
          return undefined
        })}
      </form>
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
