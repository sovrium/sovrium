/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const DataTableGroupBySchema = Schema.Struct({
  field: Schema.String.annotations({ description: 'Field name to group rows by' }),
  direction: Schema.optional(
    Schema.Literal('asc', 'desc').annotations({
      description: 'Group sort direction (default: asc)',
    })
  ),
  collapsed: Schema.optional(
    Schema.Boolean.annotations({ description: 'Start groups collapsed (default: false)' })
  ),
  hideEmpty: Schema.optional(
    Schema.Boolean.annotations({ description: 'Hide empty groups (default: false)' })
  ),
}).annotations({
  title: 'Data Table Group By',
  description: 'Row grouping configuration',
})

export type DataTableGroupBy = Schema.Schema.Type<typeof DataTableGroupBySchema>
