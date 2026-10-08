/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CsvPreview } from './types'

/**
 * Parse the first 10 data rows of a CSV string for the preview step.
 *
 * Trims whitespace and skips empty lines; splits on commas without
 * respecting quoted fields. Sufficient for the preview surface — the
 * import path uses the same naive parsing for symmetry.
 */
export function parseCsvPreview(content: string): CsvPreview {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const [headerLine, ...dataLines] = lines
  const headers = (headerLine ?? '').split(',').map((h) => h.trim())
  const rows = dataLines.slice(0, 10).map((line) => line.split(',').map((cell) => cell.trim()))
  return { headers, rows }
}

/**
 * Lowercase + split a header/field name on non-alphanumeric runs.
 *
 *   "Email Address"  -> ["email", "address"]
 *   "full_name"      -> ["full", "name"]
 *   "Company Name"   -> ["company", "name"]
 */
function tokenize(s: string): readonly string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
}

/**
 * Auto-map a CSV header to the best-matching table field.
 *
 * Strategy (cheapest → richest):
 *   1. case-insensitive exact match (fast path; preserves prior behavior so
 *      `import-csv-records` specs that rely on `name → name` still pass)
 *   2. token-overlap match: lowercase + split both sides on non-alphanum,
 *      pick the field with the highest overlap. Examples:
 *        - "Email Address" -> field "email"     (1 shared token: "email")
 *        - "Full Name"     -> field "name"      (1 shared token: "name")
 *        - "Twitter Handle" with no related field -> undefined (left as Skip)
 *
 * Ties are broken alphabetically on the field name to keep the result
 * deterministic across renders. Returns `undefined` when no field shares
 * any token with the header — the dialog renders that as "Skip".
 */
export function matchHeaderToField(
  header: string,
  tableFields: readonly string[] | undefined
): string | undefined {
  if (!tableFields || tableFields.length === 0) return undefined

  const exact = tableFields.find((f) => f.toLowerCase() === header.toLowerCase())
  if (exact !== undefined) return exact

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
