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
 * Format currency value with symbol position
 */
function formatCurrency(
  value: number,
  currencyCode: string,
  symbolPosition: 'before' | 'after' = 'before'
): string {
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode
  const formattedValue = value.toFixed(2)

  if (symbolPosition === 'after') {
    return `${formattedValue}${symbol}`
  }

  return `${symbol}${formattedValue}`
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
                  const formatted = formatCurrency(
                    numericValue,
                    currencyField.currency,
                    currencyField.symbolPosition
                  )
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
