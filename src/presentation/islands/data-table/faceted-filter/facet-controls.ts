/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { optionLabel, optionValue } from '@/domain/models/app/tables/select-option'
import type { FacetSelections } from './facet-filters'
import type { FacetControl } from './faceted-filter'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** What the view hands over to build the facet buttons. */
export interface FacetControlInputs {
  readonly facets: readonly string[] | undefined
  readonly columnConfig: readonly DataTableColumn[] | undefined
  readonly fieldMeta: FieldMetaMap | undefined
  readonly selections: FacetSelections
  readonly onToggle: (field: string, value: string) => void
  readonly onClear: (field: string) => void
}

/** The column's own label, else the field's display name, else its name. */
function facetLabel(field: string, inputs: FacetControlInputs): string {
  const column = inputs.columnConfig?.find((col) => 'field' in col && col.field === field)
  const columnLabel = column !== undefined && 'label' in column ? column.label : undefined
  return typeof columnLabel === 'string' ? columnLabel : (inputs.fieldMeta?.[field]?.label ?? field)
}

/**
 * One control per field in `toolbar.facets`, its options the field's declared
 * options in declared order. Load-time validation guarantees each names a
 * single-select or status field of the bound table.
 */
export function buildFacetControls(inputs: FacetControlInputs): readonly FacetControl[] {
  return (inputs.facets ?? []).map((field) => ({
    field,
    label: facetLabel(field, inputs),
    options: (inputs.fieldMeta?.[field]?.options ?? []).map((option) => ({
      value: optionValue(option),
      label: optionLabel(option),
    })),
    selected: inputs.selections[field] ?? [],
    onToggle: inputs.onToggle,
    onClear: inputs.onClear,
  }))
}
