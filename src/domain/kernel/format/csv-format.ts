/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Serialising rows to CSV text.
 *
 * This exists because a grid bound to a SYSTEM read endpoint has no table
 * behind it, so there is no server that can re-read a selection and answer with
 * a file. Such a grid exports the rows it is already holding, which means the
 * serialiser has to run in the browser — hence a dependency-free kernel module
 * rather than a CSV package pulled into the client bundle.
 *
 * The dialect matches the records export route (`export-handlers.ts`) field for
 * field: the same characters force quoting, quotes double, rows join on `\n`
 * and the document ends with one. Two CSV writers speaking two dialects is how
 * the same selection comes off two grids as two different files.
 *
 * The VALUES, by contrast, are deliberately raw. The server export formats each
 * cell the way the column declares; this one writes what the read envelope
 * carried, because the envelope is all the client has. An operator comparing a
 * system-source export against a table export will see that difference, and it
 * is a stated tradeoff rather than an oversight.
 */

/** Characters that force a field to be quoted (RFC 4180 §2.6). */
const CSV_QUOTE_TRIGGERS = /[,"\n\r]/u

/**
 * Coerce one envelope value to its CSV text, mirroring the server export's
 * `buildCsvRow`.
 *
 * The object branch is the one that earns its place: an attachment arrives as a
 * whole object, and writing `[object Object]` into a column would lose the one
 * thing the operator wanted — where the file is. `JSON.stringify` is the last
 * resort, so an unrecognised object is still legible rather than erased.
 */
export function coerceCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') {
    const shape = value as { readonly url?: string; readonly name?: string }
    return shape.url ?? shape.name ?? JSON.stringify(value)
  }
  return String(value)
}

/** Quote `field` if it carries a delimiter, a quote or a line break. */
export function escapeCsvField(field: string): string {
  return CSV_QUOTE_TRIGGERS.test(field) ? `"${field.replaceAll('"', '""')}"` : field
}

/** One CSV line: each column read off `row`, coerced, escaped, comma-joined. */
function buildCsvLine(columns: readonly string[], row: Readonly<Record<string, unknown>>): string {
  return columns.map((column) => escapeCsvField(coerceCsvValue(row[column]))).join(',')
}

/**
 * The whole CSV document: a header naming `columns`, then one line per row.
 *
 * The header carries the column IDS rather than their labels, matching what the
 * records export sends as `fields=` — a re-import has to find the column again,
 * and a label is free to be renamed or translated.
 */
export function serializeRowsToCsv(
  columns: readonly string[],
  rows: readonly Readonly<Record<string, unknown>>[]
): string {
  const header = columns.map(escapeCsvField).join(',')
  return [header, ...rows.map((row) => buildCsvLine(columns, row))].join('\n') + '\n'
}
