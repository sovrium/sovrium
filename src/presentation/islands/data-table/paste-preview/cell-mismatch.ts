/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SKIP_VALUE } from './skip-value'
import type { ParsedTsv } from './parse-tsv'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

export function isCellTypeMismatch(value: string, fieldType: string | undefined): boolean {
  if (fieldType !== 'number') return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  return !Number.isFinite(Number(trimmed))
}

export const TYPE_MISMATCH_MESSAGE = 'Type mismatch: invalid number'

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
