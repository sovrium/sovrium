/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View Group By Schema
 *
 * Grouping configuration for the view. Specifies which field to group records by.
 *
 * @example
 * ```typescript
 * { field: 'status' }
 * { field: 'category', order: 'asc' }
 * { field: 'priority', order: 'desc' }
 * ```
 */
export const ViewGroupBySchema = Schema.Struct({
  field: Schema.String,
  order: Schema.optional(Schema.Literal('asc', 'desc')),
}).pipe(
  Schema.annotations({
    title: 'View Group By',
    description: 'Grouping configuration specifying which field to group by.',
  })
)

export type ViewGroupBy = Schema.Schema.Type<typeof ViewGroupBySchema>
