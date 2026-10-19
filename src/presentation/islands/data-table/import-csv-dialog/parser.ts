/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CsvPreview, CsvSeparator } from './types'

/** The separators a spreadsheet export uses, in the order a tie is settled. */
const SEPARATORS: readonly CsvSeparator[] = [',', ';', '\t']

/** How many times `separator` occurs in `line`. */
const occurrences = (line: string, separator: string): number => line.split(separator).length - 1

/**
 * The separator a file's header line is written with: the one it holds most
 * of. A French spreadsheet exports with `;` — its decimal comma would split a
 * number in two — and a tab-separated paste holds tabs; a comma wins a tie,
 * and a single-column file, which holds none, reads as comma-separated.
 */
export function detectSeparator(headerLine: string): CsvSeparator {
  return SEPARATORS.reduce<CsvSeparator>(
    (best, candidate) =>
      occurrences(headerLine, candidate) > occurrences(headerLine, best) ? candidate : best,
    ','
  )
}

/** The non-empty lines of a CSV file, trimmed. */
export function csvLines(content: string): readonly string[] {
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

/** One CSV line's cells, split on `separator` and trimmed (quoted fields are not unwrapped). */
export const splitCsvLine = (line: string, separator: CsvSeparator): readonly string[] =>
  line.split(separator).map((cell) => cell.trim())

/**
 * Parse a CSV string: its header, every data row, the separator it was written
 * with and how many rows it holds. The preview draws the first rows; the
 * import reads all of them with the same separator.
 */
export function parseCsvPreview(content: string): CsvPreview {
  const [headerLine = '', ...dataLines] = csvLines(content)
  const separator = detectSeparator(headerLine)
  return {
    headers: splitCsvLine(headerLine, separator),
    rows: dataLines.map((line) => splitCsvLine(line, separator)),
    separator,
  }
}

/**
 * The form a header and a field name or label are compared in: decomposed,
 * stripped of its accents, lowercased — so "NUMÉRO", "Numero" and "numéro"
 * read the same, and "Numéro" stays one word rather than "num" + "ro".
 */
export function normalizeHeaderText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/**
 * Normalize + split a header/field name on non-alphanumeric runs.
 *
 *   "Email Address"  -> ["email", "address"]
 *   "full_name"      -> ["full", "name"]
 *   "Numéro"         -> ["numero"]
 */
function tokenize(s: string): readonly string[] {
  return normalizeHeaderText(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
}

/**
 * The labels a field reads under, one per language the app declares, by field
 * name: the words a spreadsheet kept in any of those languages heads its
 * columns with.
 */
export type FieldLabelCandidates = Readonly<Record<string, readonly string[]>>

/**
 * Auto-map a CSV header to the best-matching table field.
 *
 * Strategy (cheapest → richest), every comparison on normalized text
 * ({@link normalizeHeaderText}: no accents, no case):
 *   1. the field's NAME (preserves the `name → name` behaviour)
 *   2. one of the field's LABELS, in any language the app declares, so a
 *      French export headed "Montant HT" finds `amount_excl_tax`
 *   3. token overlap with the field name — pick the field sharing the most
 *      words with the header. Examples:
 *        - "Email Address" -> field "email"     (1 shared token: "email")
 *        - "Full Name"     -> field "name"      (1 shared token: "name")
 *        - "Twitter Handle" with no related field -> undefined (left as Skip)
 *
 * Ties are broken alphabetically on the field name to keep the result
 * deterministic across renders. Returns `undefined` when nothing matches —
 * the dialog renders that as "Skip".
 */
export function matchHeaderToField(
  header: string,
  tableFields: readonly string[] | undefined,
  fieldLabels?: FieldLabelCandidates
): string | undefined {
  if (!tableFields || tableFields.length === 0) return undefined

  const normalized = normalizeHeaderText(header)
  if (normalized.length === 0) return undefined
  const byName = tableFields.find((f) => normalizeHeaderText(f) === normalized)
  if (byName !== undefined) return byName
  const byLabel = tableFields.find((f) =>
    (fieldLabels?.[f] ?? []).some((label) => normalizeHeaderText(label) === normalized)
  )
  if (byLabel !== undefined) return byLabel

  const headerTokens = new Set(tokenize(header))
  if (headerTokens.size === 0) return undefined

  const candidates = tableFields
    .map((field) => {
      const fieldTokens = tokenize(field)
      const overlap = fieldTokens.reduce((acc, t) => (headerTokens.has(t) ? acc + 1 : acc), 0)
      return { field, overlap }
    })
    .filter((s) => s.overlap > 0)

  // Pick the best candidate via reduce (immutable; ESLint's
  // functional/immutable-data forbids `.sort()` even on a spread copy).
  // Tiebreaker: alphabetical on field name for deterministic results.
  const best = candidates.reduce<{ field: string; overlap: number } | undefined>((acc, cur) => {
    if (acc === undefined) return cur
    if (cur.overlap > acc.overlap) return cur
    if (cur.overlap === acc.overlap && cur.field.localeCompare(acc.field) < 0) return cur
    return acc
  }, undefined)

  return best?.field
}
