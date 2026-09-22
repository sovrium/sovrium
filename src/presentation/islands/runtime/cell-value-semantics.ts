/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a STORED cell value reads — the single decoding every surface that shows
 * or edits a record value shares.
 *
 * The same logical value reaches the browser in several shapes: a native type
 * on PostgreSQL, a narrower one on SQLite (no boolean, no array), and a string
 * form after a JSON round-trip, a CSV import or an HTML form encoding. Deciding
 * what those shapes MEAN is one decision, and every copy of it that has existed
 * in this codebase has drifted from its twin.
 *
 * Three drifts are on record here, all of them the same failure — a value that
 * read one way where it was DISPLAYED and another way where it was EDITED:
 *
 *  - boolean, read vs editable grid cell: the read path accepted
 *    `'true' | '1' | 'yes'` and the editable path `'true' | '1' | 'yes' | 'on'`,
 *    so a column holding `'on'` — the form encoding of a ticked checkbox —
 *    showed a cross in a read-only column and a tick in an editable one, in the
 *    same grid. The read path also trimmed before comparing and the editable
 *    path did not, so `' true'` disagreed the same way;
 *  - boolean, grid vs CRUD form: the form kept a third, STRICTER copy —
 *    `value === 'true'` — so a SQLite `1` (SQLite has no boolean type; every
 *    ticked checkbox is stored as `1`) rendered UNCHECKED in every CRUD form on
 *    the zero-config default engine, while the same row showed a tick in the
 *    grid;
 *  - list, read cell vs multi-select editor: the read path dropped empty
 *    comma segments and the editor did not, so `'a,,b'` seeded the editor with
 *    `['a', '', 'b']` while the cell beside it rendered two chips. Toggling any
 *    option then wrote the `''` back, and PostgreSQL rejected it against the
 *    per-entry membership CHECK — a 500 on an edit the user never made.
 *
 * None of the three was reachable from a spec fixture, which is exactly why
 * they survived: a mirror that no test crosses drifts silently.
 *
 * This module lives under `islands/shared/` rather than under `data-table/`
 * BECAUSE of the second drift. While the decoding sat inside the grid's own
 * folder it was, in practice, invisible to the CRUD form — so the form wrote
 * its own. A shared decision filed under one of its consumers is a decision the
 * next consumer will not find.
 */

/** Glyph pairs `[filled, hollow]` that a rating's declared `style` selects between. */
const RATING_GLYPHS: Readonly<Record<string, readonly [string, string]>> = {
  stars: ['★', '☆'],
  hearts: ['♥', '♡'],
  circles: ['●', '○'],
}

/** The scale length used when the field declares no `max`. */
export const DEFAULT_RATING_MAX = 5

/**
 * The `[filled, hollow]` glyph pair for a declared `style`, falling back to
 * stars for an unknown one.
 *
 * A function rather than the bare map so neither caller has to re-derive the
 * fallback — both previously spelled it `?? RATING_GLYPHS.stars!`, and a
 * non-null assertion repeated at every call site is an invariant asking to be
 * broken.
 */
export function ratingGlyphsFor(style: string | undefined): readonly [string, string] {
  return RATING_GLYPHS[style ?? 'stars'] ?? RATING_GLYPHS['stars']!
}

/**
 * Read a stored value as a boolean.
 *
 * The same logical `true` arrives in several shapes: a real `BOOLEAN` on
 * PostgreSQL, `INTEGER` 0/1 on SQLite (which has no boolean type), and the
 * string forms that reach a surface through a JSON round-trip, a CSV import or
 * an HTML form encoding (`'on'`). Anything else — `null`, an object, a word that
 * is not an affirmative — reads as `false`.
 */
export function readsAsTrue(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value !== 'string') return false
  const text = value.trim().toLowerCase()
  return text === 'true' || text === '1' || text === 'yes' || text === 'on'
}

/**
 * Empty entries are dropped from every branch below, not just from the
 * comma-separated one.
 *
 * An empty entry is never a value a list field can hold: a `multi-select`
 * carries a per-entry membership CHECK that `''` fails outright, and an `array`
 * field renders one for a chip with nothing in it. Dropping it in ONE branch
 * was the whole `'a,,b'` defect — the editor kept what the cell had already
 * discarded, then wrote it back.
 */
const withoutEmptyEntries = (entries: readonly string[]): readonly string[] =>
  entries.filter((entry) => entry !== '')

/**
 * Read a stored list-valued cell as a string array — the `array` field type,
 * and `multi-select`, which is an array of declared options.
 *
 * The same list arrives in three shapes: a real array on PostgreSQL, the JSON
 * text of one on SQLite, and a comma-joined string from rows written before the
 * inline editor existed. Reading only the first would make an editor open EMPTY
 * over a populated cell — and then write that emptiness back.
 *
 * A scalar that is neither array nor string (a lone number, say) reads as a
 * one-entry list rather than as nothing. That is the wider of the two readings
 * this function replaced, chosen deliberately: a stored value that renders as a
 * chip can be seen and corrected, whereas one that renders as the em-dash
 * placeholder is indistinguishable from an empty cell.
 */
export function readsAsList(value: unknown): readonly string[] {
  if (Array.isArray(value)) return withoutEmptyEntries(value.map((entry) => String(entry)))
  if (typeof value !== 'string') {
    return value === null || value === undefined ? [] : withoutEmptyEntries([String(value)])
  }

  const trimmed = value.trim()
  if (trimmed === '') return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return withoutEmptyEntries(parsed.map((entry) => String(entry)))
    } catch {
      // Not JSON after all — fall through to the comma-joined reading.
    }
  }
  return withoutEmptyEntries(trimmed.split(',').map((entry) => entry.trim()))
}
