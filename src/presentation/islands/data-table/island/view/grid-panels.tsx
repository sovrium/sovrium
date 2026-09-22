/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { FilterOverlay } from '../filter-overlay'
import { SortOverlay } from '../sort-overlay'
import type { GridPanelsProps } from '../view-props'

/** The runtime filter-builder panel. */
export function FilterPanel(props: GridPanelsProps) {
  return (
    <FilterOverlay
      tableFields={props.tableFields}
      fieldMeta={props.fieldMeta}
      activeFilters={props.ui.activeFilters}
      filterConjunction={props.ui.filterConjunction}
      onAddFilter={props.ui.addFilter}
      onRemoveFilter={props.ui.removeFilter}
      onClearAll={props.ui.clearAllFilters}
      onToggleConjunction={props.ui.toggleConjunction}
      onClose={props.ui.onCloseFilterOverlay}
    />
  )
}

/** The runtime multi-sort panel. */
export function SortPanel(props: GridPanelsProps) {
  return (
    <SortOverlay
      tableFields={props.tableFields}
      activeSorts={props.ui.activeSorts}
      onAddSort={props.ui.addSort}
      onRemoveSort={props.ui.removeSort}
      onClearAll={props.ui.clearAllSorts}
      onReorderSort={props.ui.reorderSort}
    />
  )
}
