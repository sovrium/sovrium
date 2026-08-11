/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Parse a clipboard TSV (tab-separated values) payload for the paste-preview
 * dialog.
 *
 * Spreadsheets (Excel, Google Sheets) put TSV on the clipboard when a range of
 * cells is copied. The first non-empty line is treated as the header row; the
 * remaining lines are data rows. Whitespace is trimmed and fully empty lines
 * are dropped.
 */

export interface ParsedTsv {
  /** Column header labels, in order. */
  readonly headers: readonly string[]
  /** All data rows (every row has `headers.length` cells, padded if short). */
  readonly rows: readonly (readonly string[])[]
}

/** Splits a single TSV line into its tab-delimited cells. */
function splitLine(line: string): readonly string[] {
  return line.split('\t')
}

/**
 * Parse a TSV string into headers + data rows.
 *
 * Returns empty headers/rows when the payload has no usable content.
 */
export function parseTsv(content: string): ParsedTsv {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = splitLine(lines[0]!).map((cell) => cell.trim())
  const width = headers.length

  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line).map((cell) => cell.trim())
    // Pad short rows so every data row aligns with the header columns.
    return Array.from({ length: width }, (_, i) => cells[i] ?? '')
  })

  return { headers, rows }
}
