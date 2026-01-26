/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { CurrencyField } from '@/domain/models/app/table/field-types/currency-field'

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
  const thousandsSeparator = (field.thousandsSeparator ?? 'comma') as ThousandsSeparator

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
    // Convert string to number if needed (database may return numeric values as strings)
    const numericValue = typeof value === 'string' ? parseFloat(value) : (value as number)
    if (typeof numericValue === 'number' && !isNaN(numericValue)) {
      return formatCurrency(numericValue, field as CurrencyField)
    }
  }

  // Return undefined for types that don't need formatting yet
  return undefined
}
