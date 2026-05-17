/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Grouping configuration for rows.
 *
 * @example
 * ```yaml
 * groupBy:
 *   field: status
 *   direction: asc
 *   collapsed: false
 * ```
 */
export const DataTableGroupBySchema = Schema.Struct({
  /** Field to group rows by */
  field: Schema.String.annotations({ description: 'Field name to group rows by' }),
  /** Group sort direction */
  direction: Schema.optional(
    Schema.Literal('asc', 'desc').annotations({
      description: 'Group sort direction (default: asc)',
    })
  ),
  /** Start groups collapsed */
  collapsed: Schema.optional(
    Schema.Boolean.annotations({ description: 'Start groups collapsed (default: false)' })
  ),
  /** Hide groups with no records */
  hideEmpty: Schema.optional(
    Schema.Boolean.annotations({ description: 'Hide empty groups (default: false)' })
  ),
}).annotations({
  title: 'Data Table Group By',
  description: 'Row grouping configuration',
})

export type DataTableGroupBy = Schema.Schema.Type<typeof DataTableGroupBySchema>
