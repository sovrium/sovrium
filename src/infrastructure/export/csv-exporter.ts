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

/**
 * Export data as CSV using csv-stringify.
 */
export const exportToCsv = (options: CsvExportOptions): string =>
  stringify(options.rows as unknown[][], {
    columns: options.columns as string[],
    header: options.header ?? true,
    delimiter: options.delimiter ?? ',',
  })

/**
 * Export records (array of objects) as CSV.
 *
 * Zero records with KNOWN columns is a header row and no data rows — an empty
 * TABLE, which is the true statement. Short-circuiting on the row count instead
 * discarded the columns the caller had already resolved and handed the operator
 * a zero-byte file, indistinguishable from a download that failed. "Your filter
 * matched nothing" and "the export broke" are different facts, and a spreadsheet
 * refuses to open the first as readily as the second.
 *
 * Columns can otherwise only be inferred from the first record, so a call with
 * neither records nor an explicit column list still yields an empty string:
 * there is nothing to name.
 *
 * @public
 */
export const exportRecordsToCsv = (
  records: readonly Readonly<Record<string, unknown>>[],
  columns?: readonly string[]
): string => {
  const cols = columns ?? Object.keys(records[0] ?? {})
  if (cols.length === 0) return ''

  const rows = records.map((record) => cols.map((col) => record[col]))

  return exportToCsv({ columns: cols, rows })
}
