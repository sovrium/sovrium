/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CurrencyField } from '@/domain/models/app/table/field-types/currency-field'
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
  return isNegative
    ? negativeFormat === 'parentheses'
      ? `(${result})`
      : `-${result}`
    : result
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
 * applyThousandsSeparator("1000000.00", "period") // "1.000.000.00"
 */
function applyThousandsSeparator(
  value: string,
  separator: 'comma' | 'period' | 'space'
): string {
  // Split on period (decimal separator)
  const parts = value.split('.')
  const integerPart = parts[0] || '0'
  const decimalPart = parts[1]

  // Map separator type to character
  const separatorChar = separator === 'comma' ? ',' : separator === 'period' ? '.' : ' '

  // Insert separator every 3 digits from right to left
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separatorChar)

  // Reconstruct with original decimal separator (always period)
  return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
}

export interface TableViewProps {
  readonly table: Table
  readonly records: readonly Record<string, unknown>[]
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
              {table.fields.map((field) => {
                const value = record[field.name]

                // Format currency fields
                if (field.type === 'currency') {
                  const currencyField = field as CurrencyField
                  const numericValue =
                    typeof value === 'number' ? value : parseFloat(String(value || 0))
                  const formatted = formatCurrency(numericValue, {
                    currencyCode: currencyField.currency,
                    symbolPosition: currencyField.symbolPosition,
                    precision: currencyField.precision,
                    negativeFormat: currencyField.negativeFormat,
                    thousandsSeparator: currencyField.thousandsSeparator,
                  })
                  return <td key={field.id}>{formatted}</td>
                }

                // Default: display as string
                return <td key={field.id}>{String(value ?? '')}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
