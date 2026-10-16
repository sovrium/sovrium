/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  columnFilteringFeature,
  createFilteredRowModel,
  globalFilteringFeature,
} from '@tanstack/react-table'

/**
 * The filter slots' slice of the grid's feature registry.
 *
 * `filteredRowModel` IS required: `manualFiltering` is the runtime
 * `serverFiltered` flag, false for most data sources, and the model also backs
 * `getFilteredSelectedRowModel()` — the rows the selection export reads. One
 * model runs both the column filters and the global filter, which is why both
 * filtering features are registered.
 *
 * `columnFilteringFeature` is registered for that row model and for the GLOBAL
 * filter alone: `createFilteredRowModel` lives in that feature and imports
 * `column_getFilterFn` from it. The `state.columnFilters` slot it also brings
 * is never written: the rows a reader narrows arrive narrowed from the server,
 * through the controls the page composes on the grid's channel.
 */
export const filteringFeatures = {
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
} as const
