/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveDisplayLabel } from '@/presentation/design/field-display'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** The words a panel names each field by, keyed by field name. */
export type FieldLabels = Readonly<Record<string, string>>

/**
 * Each field named as its column header names it: the column's `label`, else
 * the field's declared label, else the raw field name — so the filter and sort
 * builders speak the same words as the grid beside them.
 */
export function buildFieldLabels(
  fields: readonly string[],
  columns: readonly DataTableColumn[] | undefined,
  fieldMeta: FieldMetaMap | undefined
): FieldLabels {
  return Object.fromEntries(
    fields.map((field) => {
      const column = columns?.find((col) => 'field' in col && col.field === field)
      const override = column !== undefined && 'label' in column ? column.label : undefined
      return [
        field,
        resolveDisplayLabel(
          typeof override === 'string' ? override : undefined,
          fieldMeta?.[field]?.label,
          field
        ),
      ]
    })
  )
}

/** A field's panel name, or the field itself when the panel was given no labels. */
export const labelOfField = (labels: FieldLabels | undefined, field: string): string =>
  labels?.[field] ?? field
