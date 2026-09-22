/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { coerceFieldValue } from '../../runtime/field-value-coercion'
import { SKIP_VALUE } from './skip-value'
import type { ParsedTsv } from './parse-tsv'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

/**
 * Detect whether a pasted cell value is incompatible with the target field's
 * type.
 *
 * The verdict comes from the ONE shared coercion rule
 * (`shared/field-value-coercion.ts`) rather than a local `number`-only check,
 * so the paste preview cannot flag a cell the fill handle would have written,
 * or wave through one it would have refused.
 */
export function isCellTypeMismatch(value: string, fieldType: string | undefined): boolean {
  return !coerceFieldValue(value, fieldType, '').ok
}

/**
 * The human-readable tooltip message shown when hovering a mismatched cell.
 */
export const TYPE_MISMATCH_MESSAGE = 'Type mismatch: invalid number'

/**
 * Compute, per data row, which cells are type-mismatched against the field
 * they are mapped to.
 *
 * Returns a row-aligned matrix of booleans (`true` = mismatch). Columns mapped
 * to {@link SKIP_VALUE} or to a field with no metadata are never flagged.
 */
export function computeMismatchMatrix(
  parsed: ParsedTsv,
  mappings: readonly string[],
  fieldMeta: FieldMetaMap | undefined
): readonly (readonly boolean[])[] {
  return parsed.rows.map((row) =>
    parsed.headers.map((_, columnIndex) => {
      const target = mappings[columnIndex] ?? SKIP_VALUE
      if (target === SKIP_VALUE) return false
      const fieldType = fieldMeta?.[target]?.type
      return isCellTypeMismatch(row[columnIndex] ?? '', fieldType)
    })
  )
}
