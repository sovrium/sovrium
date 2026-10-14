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
 * `getFilteredSelectedRowModel()` and the filtered-count readout in
 * `view-props.ts`. One model runs both the column filters and the global
 * filter, which is why both filtering features are registered.
 *
 * `columnFilteringFeature` is registered for that row model and for the GLOBAL
 * filter alone: `createFilteredRowModel` lives in that feature and imports
 * `column_getFilterFn` from it. The `state.columnFilters` slot it also brings
 * is deliberately never written: nothing calls `setFilterValue`, and the
 * runtime filter builder narrows rows before they reach the instance
 * (`applyClientFilters`). Three properties keep it that way, each pinned by a
 * test in `island-setup-helpers.test.ts`: the panel's AND/OR conjunction
 * (column filters are always AND, and a view's OR filters are specified
 * behaviour), several filter rows on ONE field (the state is keyed
 * by column id, so a second entry would collide rather than intersect), and
 * filtering on a field the grid renders no column for.
 */
export const filteringFeatures = {
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
} as const
