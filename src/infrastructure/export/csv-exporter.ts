/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stringify } from 'csv-stringify/sync'

export interface CsvExportOptions {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly unknown[])[]
  readonly delimiter?: string
  readonly header?: boolean
}

export const exportToCsv = (options: CsvExportOptions): string =>
  stringify(options.rows as unknown[][], {
    columns: options.columns as string[],
    header: options.header ?? true,
    delimiter: options.delimiter ?? ',',
  })

export const exportRecordsToCsv = (
  records: readonly Readonly<Record<string, unknown>>[],
  columns?: readonly string[]
): string => {
  if (records.length === 0) return ''

  const cols = columns ?? Object.keys(records[0] ?? {})
  const rows = records.map((record) => cols.map((col) => record[col]))

  return exportToCsv({ columns: cols, rows })
}
