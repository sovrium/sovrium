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
 * Format currency value with symbol position, precision, and negative format
 */
function formatCurrency(
  value: number,
  options: {
    readonly currencyCode: string
    readonly symbolPosition?: 'before' | 'after'
    readonly precision?: number
    readonly negativeFormat?: 'minus' | 'parentheses'
  }
): string {
  const {
    currencyCode,
    symbolPosition = 'before',
    precision = 2,
    negativeFormat = 'minus',
  } = options
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode
  const absValue = Math.abs(value)
  const formattedValue = absValue.toFixed(precision)
  const isNegative = value < 0

  const result =
    symbolPosition === 'after' ? `${formattedValue}${symbol}` : `${symbol}${formattedValue}`

  // Apply negative format
  return isNegative
    ? negativeFormat === 'parentheses'
      ? `(${result})`
      : `-${result}`
    : result
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
