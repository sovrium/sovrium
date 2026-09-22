/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a `relationship` field's LINKS travel through the CRUD form's value map.
 *
 * The form's state is `Record<string, string>` end to end — every control
 * reports a string and `buildInitialValues` `String()`s the bound record. A
 * multi-valued picker holds a LIST, so it needs an encoding, and the one used
 * here is the one the form already uses for the other structured control: the
 * file field JSON-encodes its attachment metadata into the same string map and
 * re-parses on the way out (FORM-037).
 *
 * Widening `onChange` to `(name: string, value: string | readonly string[])`
 * was the alternative, and was refused: `onChange` is threaded through every
 * control, the layout, the conditional-visibility evaluator and the submit
 * pipeline, all of which compare and trim values as strings. Changing that
 * signature to serve one control makes six call sites reason about two shapes,
 * where JSON-encoding makes one control reason about one.
 *
 * A SINGLE-valued picker stores the bare foreign key with no encoding at all,
 * because that is exactly what the column holds and what the write must send.
 */

/**
 * The ids a stored form value represents.
 *
 * Deliberately tolerant in both directions. A single-valued field seeded from a
 * record holds a bare key (`'1'`); a multi-valued one holds a JSON array. A
 * multi-valued field seeded from a scalar — a column that used to be
 * single-valued, or an `initialValues` entry from a URL — reads as one link
 * rather than as nothing, so widening a field never silently drops its
 * existing link.
 */
export function readLinkedIds(value: string, allowMultiple: boolean): readonly string[] {
  const raw = value.trim()
  if (raw === '') return []
  if (!allowMultiple) return [raw]
  if (!raw.startsWith('[')) return [raw]
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [raw]
    return parsed.map((entry) => (typeof entry === 'string' ? entry : String(entry)))
  } catch {
    // A value that is not the JSON we wrote is still SOMETHING the reader
    // linked; treating it as one opaque key keeps it visible and removable.
    return [raw]
  }
}

/**
 * The stored form value for a set of ids.
 *
 * An empty selection is the empty string, never `'[]'`: `''` is the sentinel
 * every other part of the form already reads as "nothing entered" — the
 * required-field check trims it, and `omitsEmptyValue` uses it to keep an
 * untouched relational column out of the write entirely, so that a NULLable
 * foreign key stays NULL instead of failing on an empty-string cast.
 */
export function writeLinkedIds(ids: readonly string[], allowMultiple: boolean): string {
  if (ids.length === 0) return ''
  return allowMultiple ? JSON.stringify(ids) : (ids[0] ?? '')
}
