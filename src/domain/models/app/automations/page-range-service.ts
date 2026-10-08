/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `pages` selection of a PDF action — `'3'`, `'1-3'`, `'5-'` (to the end),
 * `'3,1-2'` — turned into the 0-based page indexes it takes, in the order
 * written, against a document of `pageCount` pages.
 *
 * Every range must fit: a page or range past the last page is refused with
 * the range as written, so the step error names it and the page count.
 */
export type PageSelection =
  | { readonly ok: true; readonly indexes: readonly number[] }
  | { readonly ok: false; readonly range: string }

const PART = /^([1-9]\d*)(?:-([1-9]\d*)?)?$/

/** The 0-based indexes of one part (`'3'`, `'1-3'`, `'5-'`), or `undefined` when it does not fit. */
const partIndexes = (part: string, pageCount: number): readonly number[] | undefined => {
  const match = PART.exec(part.trim())
  if (match === null) return undefined
  const first = Number(match[1])
  const isRange = part.includes('-')
  const last = isRange ? (match[2] === undefined ? pageCount : Number(match[2])) : first
  if (first > pageCount || last > pageCount || last < first) return undefined
  return Array.from({ length: last - first + 1 }, (_, i) => first - 1 + i)
}

/** The pages a selection takes from a document of `pageCount` pages; all of them without one. */
export const selectPages = (pages: string | undefined, pageCount: number): PageSelection => {
  if (pages === undefined || pages.trim() === '') {
    return { ok: true, indexes: Array.from({ length: pageCount }, (_, i) => i) }
  }
  const parts = pages.split(',')
  const selected = parts.map((part) => ({
    part: part.trim(),
    indexes: partIndexes(part, pageCount),
  }))
  const refused = selected.find((entry) => entry.indexes === undefined)
  if (refused !== undefined) return { ok: false, range: refused.part }
  return { ok: true, indexes: selected.flatMap((entry) => entry.indexes ?? []) }
}
