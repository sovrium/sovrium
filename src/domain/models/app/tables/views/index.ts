/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ViewFieldsSchema } from './fields'
import { ViewFiltersSchema } from './filters'
import { ViewGroupBySchema } from './group-by'
import { ViewIdSchema } from './id'
import { ViewNameSchema } from './name'
import { ViewPermissionsSchema } from './permissions'
import { ViewSortSchema } from './sorts'

export const ViewSchema = Schema.Struct({
  id: ViewIdSchema,
  name: ViewNameSchema,

  query: Schema.optional(Schema.String),

  materialized: Schema.optional(Schema.Boolean),

  refreshOnMigration: Schema.optional(Schema.Boolean),

  isDefault: Schema.optional(Schema.Boolean),

  filters: Schema.optional(ViewFiltersSchema),

  sorts: Schema.optional(Schema.Array(ViewSortSchema)),

  fields: Schema.optional(ViewFieldsSchema),

  groupBy: Schema.optional(ViewGroupBySchema),

  permissions: Schema.optional(ViewPermissionsSchema),
}).pipe(
  Schema.annotations({
    title: 'View',
    description:
      'A database view configuration for a table. Supports both SQL query mode (PostgreSQL VIEW) and JSON config mode (declarative filters, sorts, grouping).',
    examples: [
      {
        id: 'active_users',
        name: 'Active Users',
        query: 'SELECT * FROM users WHERE active = true',
      },
      {
        id: 'order_stats',
        name: 'Order Statistics',
        query:
          'SELECT customer_id, COUNT(*) as order_count, SUM(amount) as total FROM orders GROUP BY customer_id',
        materialized: true,
        refreshOnMigration: true,
      },
      {
        id: 1,
        name: 'Active Tasks',
        isDefault: true,
        filters: {
          and: [{ field: 'status', operator: 'equals', value: 'active' }],
        },
        sorts: [{ field: 'priority', direction: 'desc' as const }],
      },
    ],
  })
)

export type View = Schema.Schema.Type<typeof ViewSchema>

export const ViewsSchema = Schema.Array(ViewSchema).pipe(
  Schema.annotations({
    title: 'Views',
    description: 'Collection of saved views for a table.',
  })
)

export type Views = Schema.Schema.Type<typeof ViewsSchema>

export * from './id'
export * from './name'
export * from './filters'
export * from './sorts'
export * from './fields'
export * from './group-by'
export * from './permissions'
