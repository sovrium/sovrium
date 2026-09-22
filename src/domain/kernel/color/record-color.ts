/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { deriveOptionChipColors, type OptionChipColors } from './option-chip-color'

/**
 * How a record view (`kanban`, `calendar`, `data-timeline`) turns one
 * `colorField` VALUE into painted colours.
 *
 * [[internal ref] A7](../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)
 * ruling 1 names `colorField` as record data, so the same contract the grid's
 * option chips obey applies here: the author's declared hex is the fill, and
 * the platform derives its companions (ruling 3). This module is the shared
 * seam so the three surfaces cannot drift into three different answers for the
 * same declaration.
 *
 * Two properties matter more than the palette itself:
 *
 *  1. **A colour is a function of the VALUE, never of the record set.** An
 *     ordinal mapping (assign palette[0] to whatever appears first) silently
 *     recolours a record when a DIFFERENT record is deleted, which makes the
 *     colour meaningless as a signal. The fallback therefore hashes the value.
 *  2. **A declared colour always wins.** The fallback exists only for a field
 *     whose options declare no colour at all — it must never override, and
 *     never leak onto, an author who did declare one.
 */

/**
 * FNV-1a-style hash — fast, stable, no crypto dependency, and identical across
 * renders and processes for a given string. Bounded to `[0, modulo)`.
 */
export const hashStringToIndex = (value: string, modulo: number): number => {
  const initialHash = 2_166_136_261
  const hash = Array.from(value).reduce(
    (acc, ch) => Math.imul(acc ^ ch.charCodeAt(0), 16_777_619),
    initialHash
  )
  return Math.abs(hash) % modulo
}

/**
 * Resolve the fill/foreground/border a record view should paint for one
 * `colorField` value.
 *
 * @param value - the record's stringified `colorField` value
 * @param optionColors - `optionValue → #RRGGBB`, resolved server-side from the
 *   named field's declared options. Absent when the field declares no colours.
 * @param fallbackPalette - the surface's EXISTING palette, used only when the
 *   value carries no declaration. Pass an empty palette for a surface that
 *   paints nothing today: A7 ruling 5 makes this an opt-in, so a surface which
 *   has never invented a hue must not start inventing one.
 * @returns the painted trio, or `undefined` when nothing should be painted
 */
export const resolveRecordColor = (
  value: string,
  optionColors: Readonly<Record<string, string>> | undefined,
  fallbackPalette: readonly string[]
): OptionChipColors | undefined => {
  const declared = optionColors?.[value]
  const derived = declared === undefined ? undefined : deriveOptionChipColors(declared)
  // A declared-but-malformed hex falls through to the fallback rather than
  // painting nothing: the schema already rejects those, so reaching here means
  // the value never came from a validated option in the first place.
  if (derived) return derived

  if (fallbackPalette.length === 0) return undefined
  const fallback = fallbackPalette[hashStringToIndex(value, fallbackPalette.length)]
  return fallback === undefined ? undefined : deriveOptionChipColors(fallback)
}
