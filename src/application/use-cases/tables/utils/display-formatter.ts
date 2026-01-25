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
  const negativeFormat = field.negativeFormat ?? 'minus'
  const thousandsSeparator = field.thousandsSeparator ?? 'comma'

  // Handle negative values
  const isNegative = value < 0
  const absoluteValue = Math.abs(value)

  // Format the number with precision
  const formattedNumber = absoluteValue.toFixed(precision)

  // Apply thousands separator
  const [integerPartRaw, decimalPart] = formattedNumber.split('.')
  const integerPartBase = integerPartRaw ?? '0'

  const integerPart =
    thousandsSeparator !== 'none'
      ? (() => {
          const separator =
            thousandsSeparator === 'comma'
              ? ','
              : thousandsSeparator === 'period'
                ? '.'
                : thousandsSeparator === 'space'
                  ? ' '
                  : ''

          return integerPartBase.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
        })()
      : integerPartBase

  // Reconstruct number with decimal separator
  const decimalSeparator =
    thousandsSeparator === 'period' ? ',' : thousandsSeparator === 'comma' ? '.' : '.'
  const reconstructedNumber =
    precision > 0 ? `${integerPart}${decimalSeparator}${decimalPart}` : integerPart

  // Apply symbol position
  const amountWithSymbol =
    symbolPosition === 'before'
      ? `${symbol}${reconstructedNumber}`
      : `${reconstructedNumber}${symbol}`

  // Apply negative format
  if (isNegative) {
    if (negativeFormat === 'parentheses') {
      return `(${amountWithSymbol})`
    }
    return `-${amountWithSymbol}`
  }

  return amountWithSymbol
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
