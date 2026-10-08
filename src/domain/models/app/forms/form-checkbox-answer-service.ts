/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a checkbox answer means.
 *
 * A browser posts a ticked box as its default `value`, the string `on`, and
 * an unticked one not at all; a script posts `true`/`false`, `1`/`0`, as a
 * boolean, a number or their text. A checkbox column holds exactly two
 * answers, so every spelling collapses to `true` or `false` — and "left out"
 * is `false`, never an empty value: "did not agree" and "was never asked"
 * must not read the same in a grid, an export or a filter.
 */

const TICKED_WORDS: ReadonlySet<string> = new Set(['on', 'true', '1'])
const UNTICKED_WORDS: ReadonlySet<string> = new Set(['off', 'false', '0', ''])

/**
 * The stored answer for a posted checkbox value: `true` for a ticked
 * spelling, `false` for an unticked one or for no value at all. Any other
 * value is returned unchanged, so the column's own validation refuses it.
 */
export const toCheckboxAnswer = (value: unknown): unknown => {
  if (value === undefined || value === null) return false
  if (typeof value === 'boolean') return value
  if (value === 1) return true
  if (value === 0) return false
  if (typeof value !== 'string') return value
  const word = value.trim().toLowerCase()
  if (TICKED_WORDS.has(word)) return true
  if (UNTICKED_WORDS.has(word)) return false
  return value
}

/** True only for a ticked answer — what a required checkbox (a consent) demands. */
export const isCheckboxTicked = (value: unknown): boolean => toCheckboxAnswer(value) === true
