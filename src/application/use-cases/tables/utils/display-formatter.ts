/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { CurrencyField } from '@/domain/models/app/table/field-types/currency-field'
import type { DateField } from '@/domain/models/app/table/field-types/date-field'

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
 * Format a date value based on the date format configuration
 *
 * @param value - The date value (string or Date object)
 * @param field - The date field configuration
 * @returns Formatted date string
 */
function formatDate(value: unknown, field: DateField): string {
  // Parse the date value
  const date =
    value instanceof Date ? value : typeof value === 'string' ? new Date(value) : new Date()

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return ''
  }

  // Get date components
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // getMonth() returns 0-11
  const day = date.getDate()

  // Format based on dateFormat setting
  const dateFormat = field.dateFormat ?? 'US'

  // Format date using immutable mapping pattern
  const formatMap: Record<string, string> = {
    US: `${month}/${day}/${year}`, // US format: M/D/YYYY (no leading zeros)
    European: `${day}/${month}/${year}`, // European format: D/M/YYYY (no leading zeros)
    ISO: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, // ISO format: YYYY-MM-DD (with leading zeros)
  }

  const formattedDate = formatMap[dateFormat] ?? `${month}/${day}/${year}` // Default to US format

  // Append time if includeTime is true OR if field type is 'datetime'
  const shouldIncludeTime = field.includeTime || field.type === 'datetime'
  if (shouldIncludeTime) {
    const hours = date.getHours()
    const minutes = date.getMinutes()

    // Format time based on timeFormat setting
    const timeFormat = field.timeFormat ?? '24-hour'
    let formattedTime: string

    if (timeFormat === '12-hour') {
      // Convert to 12-hour format with AM/PM
      const period = hours >= 12 ? 'PM' : 'AM'
      const hours12 = hours % 12 || 12 // Convert 0 to 12, keep 1-12
      formattedTime = `${hours12}:${String(minutes).padStart(2, '0')} ${period}`
    } else {
      // Use 24-hour format
      formattedTime = `${hours}:${String(minutes).padStart(2, '0')}`
    }

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
function formatDateField(value: unknown, field: DateField): string | undefined {
  return formatDate(value, field)
}

/**
 * Format a field value for display based on field type and configuration
 *
 * @param fieldName - The name of the field
 * @param value - The field value
 * @param app - The application schema
 * @param tableName - The table name
 * @returns Formatted display value or undefined if no formatting needed
 */
export function formatFieldForDisplay(
  fieldName: string,
  value: unknown,
  app: App,
  tableName: string
): string | undefined {
  // Find the table and field
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return undefined

  const field = table.fields.find((f) => f.name === fieldName)
  if (!field) return undefined

  // Format based on field type
  if (field.type === 'currency') {
    return formatCurrencyField(value, field as CurrencyField)
  }

  if (field.type === 'date' || field.type === 'datetime' || field.type === 'time') {
    return formatDateField(value, field as DateField)
  }

  // Return undefined for types that don't need formatting yet
  return undefined
}
