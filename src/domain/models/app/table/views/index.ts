/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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

/**
 * View Schema
 *
 * Represents a database view configuration for a table.
 * Views can be defined in two modes:
 *
 * 1. **SQL Query Mode**: Define a raw SQL query that creates a PostgreSQL VIEW
 * 2. **JSON Config Mode**: Define filters, sorts, fields, and groupBy declaratively
 *
 * Views support materialized views for caching aggregations with optional refresh on migration.
 *
 * @example SQL Query Mode (PostgreSQL VIEW)
 * ```typescript
 * const activeUsersView = {
 *   id: 'active_users',
 *   name: 'Active Users',
 *   query: 'SELECT * FROM users WHERE active = true',
 * }
 * ```
 *
 * @example Materialized View
 * ```typescript
 * const orderStatsView = {
 *   id: 'order_stats',
 *   name: 'Order Statistics',
 *   query: 'SELECT customer_id, COUNT(*) as order_count FROM orders GROUP BY customer_id',
 *   materialized: true,
 *   refreshOnMigration: true,
 * }
 * ```
 *
 * @example JSON Config Mode
 * ```typescript
 * const activeTasks = {
 *   id: 'active_tasks',
 *   name: 'Active Tasks',
 *   isDefault: true,
 *   filters: {
 *     conjunction: 'and',
 *     conditions: [{ field: 'status', operator: 'equals', value: 'active' }]
 *   },
 *   sorts: [{ field: 'priority', direction: 'desc' }],
 * }
 * ```
 */
export const ViewSchema = Schema.Struct({
  id: ViewIdSchema,
  name: ViewNameSchema,

  /**
   * SQL query for creating a PostgreSQL VIEW or MATERIALIZED VIEW.
   * When provided, the view is created using CREATE VIEW statement.
   * When omitted, JSON config mode is used (filters, sorts, fields, groupBy).
   */
  query: Schema.optional(Schema.String),

  /**
   * Whether this is a materialized view (PostgreSQL MATERIALIZED VIEW).
   * Only applicable when `query` is provided.
   * Materialized views cache query results for faster access.
   */
  materialized: Schema.optional(Schema.Boolean),

  /**
   * Whether to refresh the materialized view during migrations.
   * Only applicable when `materialized` is true.
   */
  refreshOnMigration: Schema.optional(Schema.Boolean),

  /**
   * Whether this view is the default view for the table.
   * The default view's configuration is applied when no specific view is requested.
   */
  isDefault: Schema.optional(Schema.Boolean),

  /**
   * Filter conditions for the view (JSON config mode).
   * Defines which records are included in the view.
   */
  filters: Schema.optional(ViewFiltersSchema),

  /**
   * Sort configuration for the view (JSON config mode).
   * Defines the order of records in the view.
   */
  sorts: Schema.optional(Schema.Array(ViewSortSchema)),

  /**
   * Fields to include in the view (JSON config mode).
   * Array of field names in the order they should appear.
   */
  fields: Schema.optional(ViewFieldsSchema),

  /**
   * Group by configuration for the view (JSON config mode).
   * Defines how records are grouped.
   */
  groupBy: Schema.optional(ViewGroupBySchema),

  /**
   * Role-based access permissions for the view.
   */
  permissions: Schema.optional(ViewPermissionsSchema),
}).pipe(
  Schema.annotations({
    title: 'View',
    description:
      'A database view configuration for a table. Supports both SQL query mode (PostgreSQL VIEW) and JSON config mode (declarative filters, sorts, grouping).',
    examples: [
      // SQL query mode - simple view
      {
        id: 'active_users',
        name: 'Active Users',
        query: 'SELECT * FROM users WHERE active = true',
      },
      // SQL query mode - materialized view
      {
        id: 'order_stats',
        name: 'Order Statistics',
        query:
          'SELECT customer_id, COUNT(*) as order_count, SUM(amount) as total FROM orders GROUP BY customer_id',
        materialized: true,
        refreshOnMigration: true,
      },
      // JSON config mode
      {
        id: 1,
        name: 'Active Tasks',
        isDefault: true,
        filters: {
          conjunction: 'and' as const,
          conditions: [{ field: 'status', operator: 'equals', value: 'active' }],
        },
        sorts: [{ field: 'priority', direction: 'desc' as const }],
      },
    ],
  })
)

export type View = Schema.Schema.Type<typeof ViewSchema>

/**
 * Views Array Schema
 *
 * Array of views for a table.
 */
export const ViewsSchema = Schema.Array(ViewSchema).pipe(
  Schema.annotations({
    title: 'Views',
    description: 'Collection of saved views for a table.',
  })
)

export type Views = Schema.Schema.Type<typeof ViewsSchema>

// Re-export all sub-schemas for external use
export * from './id'
export * from './name'
export * from './filters'
export * from './sorts'
export * from './fields'
export * from './group-by'
export * from './permissions'
