/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ECO_INDEX_HEADER` env var — operator toggle for the `X-Eco-Index` response
 * header (ADR 013 D6).
 *
 * When enabled, every HTTP response carries an `X-Eco-Index: A`..`G` header
 * computed from the response's transferred byte count. The grade table is
 * the [EcoIndex methodology](https://www.ecoindex.fr/comment-ca-marche/)
 * adapted to per-response byte budgets. Frugal-by-default: the header is
 * `on` unless an operator explicitly opts out.
 */
export type EcoIndexHeaderMode = 'on' | 'off'

/** Default when `ECO_INDEX_HEADER` is unset (eco-aligned). */
export const DEFAULT_ECO_INDEX_HEADER: EcoIndexHeaderMode = 'on'

/**
 * Resolve `ECO_INDEX_HEADER` from a snapshot of env vars. Only an explicit
 * `off` (case-insensitive, surrounding whitespace ignored) disables the
 * header — an unset, empty, or unrecognised value resolves to the
 * eco-aligned default (`on`). Operators opt out, they never opt in.
 */
export const parseEcoIndexHeader = (
  processEnv: Readonly<Record<string, string | undefined>>
): EcoIndexHeaderMode => {
  const raw = processEnv['ECO_INDEX_HEADER']?.trim().toLowerCase()
  return raw === 'off' ? 'off' : DEFAULT_ECO_INDEX_HEADER
}

/**
 * EcoIndex letter grade alphabet. `A` is the lowest-impact grade; `G` is the
 * highest-impact grade — same direction as the EU energy label so operators
 * already recognise the polarity.
 */
export type EcoIndexGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

/**
 * Per-response byte thresholds. A response of <=`thresholds[i]` bytes maps
 * to grade `'ABCDEFG'[i]`. The largest tier is open-ended — anything past
 * the last threshold grades `G`.
 *
 * The table is fine-grained at the small end so the low-data variant of
 * even a tiny default-homepage render grades at least one letter better
 * than its full sibling (: the spec
 * compares grade letters between full and low-data fetches of the same
 * URL). The largest threshold sits at the `ECO_PAGE_WEIGHT_BUDGET_KB=500`
 * default, beyond which the page is unambiguously over budget.
 */
const ECO_INDEX_THRESHOLDS: readonly {
  readonly maxBytes: number
  readonly grade: EcoIndexGrade
}[] = [
  { maxBytes: 2 * 1024, grade: 'A' },
  { maxBytes: 4 * 1024, grade: 'B' },
  { maxBytes: 8 * 1024, grade: 'C' },
  { maxBytes: 30 * 1024, grade: 'D' },
  { maxBytes: 100 * 1024, grade: 'E' },
  { maxBytes: 300 * 1024, grade: 'F' },
]

/**
 * Grade a response by its transferred byte count. Pure: takes the byte
 * count as input rather than reading the response body (which would
 * require buffering); the calling middleware is responsible for reading
 * the `Content-Length` header (or measuring the actual transfer).
 */
export const gradeBytes = (bytes: number): EcoIndexGrade => {
  const matched = ECO_INDEX_THRESHOLDS.find((tier) => bytes <= tier.maxBytes)
  return matched?.grade ?? 'G'
}
