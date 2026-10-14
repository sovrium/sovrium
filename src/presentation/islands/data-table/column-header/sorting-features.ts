/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
} from '@tanstack/react-table'

/**
 * The column header's slice of the grid's feature registry: sorting.
 *
 * `sortedRowModel` runs only under the runtime `clientSorted` flag (see
 * `use-table.ts`): false for every DB-table grid and for any system feed the
 * reader holds only a page of, so on those the model short-circuits. It runs
 * only where the grid holds the WHOLE result set of a source that will not sort
 * it, the one case where a browser-side sort is both necessary and complete.
 *
 * `sortFns` carries exactly the three names `column_getAutoSortFn` can select:
 * `datetime`, `alphanumeric` and `text`. Registering none is not free and not
 * silent: the resolver warns in development and falls back to `sortFn_basic`,
 * which compares with `<`, so `item10` sorts before `item2`. Registering more
 * would ship built-ins nothing can reach.
 */
export const sortingFeatures = {
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
} as const
