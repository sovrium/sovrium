/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  defaultAlignOfFieldType,
  presentedFieldType,
  readsInTabularFigures,
} from '@/domain/models/app/tables/field-type-presentation-service'
import type { FieldMeta } from '../../hooks/use-inline-editing'
import type { ColumnAlign } from '../column-align'

/**
 * The type a field's cells are drawn as: its own, except a `rollup`, which is
 * drawn as what it computes (`presentedFieldType`).
 */
export const presentedTypeOf = (meta: FieldMeta | undefined): string | undefined =>
  presentedFieldType(meta?.type, meta?.rollupResult)

/**
 * Where a column's values sit, from its field type: a quantity is
 * right-aligned and a quantity or an instant is set in tabular figures. An
 * authored `align` wins; the type only fills the gap, so a column whose author
 * chose an edge keeps it.
 */
export function typePlacementOf(
  authored: ColumnAlign | undefined,
  fieldType: string | undefined
): { readonly align?: ColumnAlign; readonly tabular?: true } {
  const align = authored ?? defaultAlignOfFieldType(fieldType)
  return {
    ...(align === undefined ? {} : { align }),
    ...(readsInTabularFigures(fieldType) ? { tabular: true as const } : {}),
  }
}
