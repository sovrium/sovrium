/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { FieldMeta } from '../../hooks/use-inline-editing'
import type { CellFieldOptions } from '../cell-renderers'

/**
 * Build the per-cell options blob a field-type renderer needs, or `undefined`
 * when the field declares nothing a renderer can read.
 *
 * This is the seam the option colour was being dropped at. Both dispatch sites
 * called `renderer({ value })` with no second argument, so `StatusPillCell`'s
 * lookup into `fieldOptions` always missed and every chip fell back to the
 * neutral tone — even though the declared options reach the island intact
 * (`type-specific-props-builder.ts` forwards `f.options` verbatim). Built ONCE
 * per column rather than per cell, so the object identity is stable across rows.
 *
 * `display` is the same story one level up: the props builder narrowed
 * `dataTableFieldMeta` to `{ type, options?, required? }`, so `rating.max`,
 * `progress.color`, `barcode.format` and `duration.displayFormat` never reached
 * the browser at all. Widening that struct is what lets the scalar renderers
 * read the field the author actually declared.
 */
export function buildCellFieldOptions(
  meta: FieldMeta | undefined,
  locale: string
): CellFieldOptions {
  // `timeZone` already travels to the editor; a read-only cell needs the same
  // one, or the grid shows one calendar day and opens on another.
  const timeZone = meta?.edit?.timeZone
  return {
    locale,
    ...(meta?.options ? { selectOptions: meta.options } : {}),
    ...(meta?.display ? { display: meta.display } : {}),
    ...(timeZone ? { timeZone } : {}),
  }
}
