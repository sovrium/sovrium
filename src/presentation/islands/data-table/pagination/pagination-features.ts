/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rowPaginationFeature } from '@tanstack/react-table'

/**
 * The pagination slot's slice of the grid's feature registry.
 *
 * The paginated row MODEL is deliberately absent: `manualPagination` is
 * hardcoded `true` (the server pages), and `table_getPaginatedRowModel`
 * short-circuits to the previous stage under it, so it could never run.
 * `getPageCount` and `getCanNextPage` come from the feature and read
 * `pageCount`.
 */
export const paginationFeatures = { rowPaginationFeature } as const
