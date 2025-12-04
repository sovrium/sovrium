/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToString } from 'react-dom/server'
import { TableView } from '@/presentation/components/tables/table-view'
import type { App } from '@/domain/models/app'
import type { CurrencyField } from '@/domain/models/app/table/field-types/currency-field'
import type { Table } from '@/domain/models/app/tables'

/**
 * Generate sample value for a field
 */
function getSampleValue(field: {
  readonly name: string
  readonly type: string
  readonly precision?: number
  readonly negativeFormat?: 'minus' | 'parentheses'
  readonly thousandsSeparator?: 'comma' | 'period' | 'space' | 'none'
}): unknown {
  switch (field.type) {
    case 'integer':
      return field.name === 'id' ? 1 : 42
    case 'currency': {
      const currencyField = field as CurrencyField
      // Use negative value for fields with parentheses format to demonstrate the feature
      if (currencyField.negativeFormat === 'parentheses') {
        return -100.0
      }
      // Use large number for fields with thousands separator to demonstrate the feature
      if (currencyField.thousandsSeparator && currencyField.thousandsSeparator !== 'none') {
        return 1_000_000.0
      }
      // Use 1000 for zero-decimal currencies (like JPY), 99.99 for others
      return currencyField.precision === 0 ? 1000 : 99.99
    }
    case 'date':
      return '2024-06-15'
    case 'datetime':
      return '2024-06-15 14:30:00'
    default:
      return `Sample ${field.name}`
  }
}

/**
 * Generate sample record for a table
 */
function generateSampleRecord(table: Table): Record<string, unknown> {
  return table.fields.reduce(
    (record, field) => ({
      ...record,
      [field.name]: getSampleValue(field),
    }),
    {} as Record<string, unknown>
  )
}

/**
 * Render table view page
 *
 * @param app - Application configuration
 * @param tableName - Name of the table to render
 * @returns HTML string or undefined if table not found
 */
export function renderTableView(app: App, tableName: string): string | undefined {
  // Find the table in the app schema
  const table = app.tables?.find((t) => t.name === tableName)

  if (!table) {
    return undefined
  }

  // Generate sample records for display
  const sampleRecords = [generateSampleRecord(table)]

  // Render the table view component
  const tableHtml = renderToString(
    <TableView
      table={table}
      records={sampleRecords}
    />
  )

  // Wrap in a minimal HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${table.name} - Sovrium</title>
</head>
<body>
  ${tableHtml}
</body>
</html>`
}
