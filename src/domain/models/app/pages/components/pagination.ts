/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const DataTablePaginationSchema = Schema.Struct({
  pageSize: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Default rows per page (default: 25)',
        examples: [10, 25, 50],
      })
    )
  ),
  pageSizeOptions: Schema.optional(
    Schema.Array(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Page size dropdown options',
        examples: [[10, 25, 50, 100]],
      })
    )
  ),
  position: Schema.optional(
    Schema.Literal('top', 'bottom', 'both').annotations({
      description: 'Position of pagination controls (default: bottom)',
    })
  ),
  serverSide: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable server-side pagination (default: false)',
    })
  ),
}).annotations({
  title: 'Data Table Pagination',
  description: 'Pagination configuration for the data table',
})

export type DataTablePagination = Schema.Schema.Type<typeof DataTablePaginationSchema>
