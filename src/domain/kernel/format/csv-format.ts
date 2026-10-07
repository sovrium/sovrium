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
 * Its cell escaper, {@link escapeCsvCell}, is also the ONLY one: the records
 * export route (`export-handlers.ts`), the operator console's CSV downloads and
 * the `file.generate-csv` automation action all write through it. The same
 * characters force quoting, quotes double, a leading formula character gains a
 * `'`, and rows join on `\n`. Two CSV writers speaking two dialects is how the
 * same selection comes off two grids as two different files — and how one of
 * them came to leave a planted formula live.
 *
 * The VALUES, by contrast, are deliberately raw. The server export formats each
 * cell the way the column declares; this one writes what the read envelope
 * carried, because the envelope is all the client has. An operator comparing a
 * system-source export against a table export will see that difference, and it
 * is a stated tradeoff rather than an oversight.
 */

/**
 * Characters a spreadsheet reads as the start of a formula when a cell begins
 * with one (OWASP "CSV Injection"): `=`, `+`, `-` and `@` outright, and a tab or
 * a carriage return once the program trims it away.
 */
const FORMULA_TRIGGERS: ReadonlySet<string> = new Set(['=', '+', '-', '@', '\t', '\r'])

/**
 * Characters that force a field to be quoted whatever the delimiter (RFC 4180
 * §2.6). The delimiter itself is the third trigger, checked per call.
 */
const CSV_QUOTE_TRIGGERS = /["\n\r]/u

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

/**
 * Quote `field` if it carries the delimiter in use, a quote or a line break.
 *
 * The delimiter is a parameter because an automation may write `;`- or
 * `|`-separated files: a value carrying the ACTIVE delimiter must be quoted or
 * it splits into two fields on re-read, while a `,` inside a `|`-separated file
 * stays bare, which is legal and lossless.
 */
export function escapeCsvField(field: string, delimiter: string = ','): string {
  const mustQuote = CSV_QUOTE_TRIGGERS.test(field) || field.includes(delimiter)
  return mustQuote ? `"${field.replaceAll('"', '""')}"` : field
}

/**
 * Write a leading `'` before text a spreadsheet would run as a formula.
 *
 * The `'` is the spreadsheet's own "this is text" marker: Excel, LibreOffice and
 * Google Sheets hide it and show the value as typed. Stripping the character
 * instead would silently alter data the operator may need.
 */
function neutraliseFormulaText(text: string): string {
  return FORMULA_TRIGGERS.has(text.charAt(0)) ? `'${text}` : text
}

/**
 * Neutralise a cell value that is about to be handed to a CSV writer which does
 * its own quoting: a STRING starting with a formula character gains its `'`,
 * every other value passes through unchanged.
 */
export function neutraliseCsvFormula(value: unknown): unknown {
  return typeof value === 'string' ? neutraliseFormulaText(value) : value
}

/** Options for {@link escapeCsvCell}. */
export interface CsvCellOptions {
  /** The column separator of the file being written. Defaults to `,`. */
  readonly delimiter?: string
  /**
   * The cell belongs to a column declared as a number. A driver may hand such a
   * value over as text (a PostgreSQL `numeric`, a `decimal` field), and it is
   * still a number: a balance of `-5` must stay `-5` and keep summing.
   */
  readonly numeric?: boolean
}

/**
 * The CSV cell escaper — every road that writes CSV goes through it.
 *
 * Two steps, in this order. First, a cell that is not a number and starts with
 * a formula character gains a leading `'`, so a spreadsheet opening the file
 * reads text rather than running `=HYPERLINK(...)` or a DDE call a visitor
 * planted. A value held as a number (`typeof` number or bigint, or a column the
 * caller declares `numeric`) is written as-is. Second, RFC 4180 quoting, so the
 * `'` sits INSIDE the quotes when the cell needs them.
 */
export function escapeCsvCell(value: unknown, options: CsvCellOptions = {}): string {
  const text = coerceCsvValue(value)
  const isNumber =
    options.numeric === true || typeof value === 'number' || typeof value === 'bigint'
  return escapeCsvField(isNumber ? text : neutraliseFormulaText(text), options.delimiter ?? ',')
}

/** One CSV line: each column read off `row`, escaped, comma-joined. */
function buildCsvLine(columns: readonly string[], row: Readonly<Record<string, unknown>>): string {
  return columns.map((column) => escapeCsvCell(row[column])).join(',')
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
  const header = columns.map((column) => escapeCsvCell(column)).join(',')
  return [header, ...rows.map((row) => buildCsvLine(columns, row))].join('\n') + '\n'
}
