/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ViewFieldConfigSchema } from './fields'
import { ViewFiltersSchema } from './filters'
import { ViewGroupBySchema } from './group-by'
import { ViewIdSchema } from './id'
import { ViewNameSchema } from './name'
import { ViewPermissionsSchema } from './permissions'
import { ViewSortSchema } from './sorts'
import { ViewTypeSchema } from './type'

/**
 * View Schema
 *
 * Represents a saved view configuration for a table.
 * Views define custom filters, sorts, field visibility, and grouping.
 *
 * @example
 * ```typescript
 * const defaultView = {
 *   id: 1,
 *   name: 'All Records',
 *   type: 'grid',
 * }
 *
 * const kanbanView = {
 *   id: 2,
 *   name: 'Task Board',
 *   type: 'kanban',
 *   groupBy: { field: 'status' },
 *   filters: {
 *     conjunction: 'and',
 *     conditions: [{ field: 'archived', operator: 'equals', value: false }]
 *   }
 * }
 * ```
 */
export const ViewSchema = Schema.Struct({
  id: ViewIdSchema,
  name: ViewNameSchema,
  type: Schema.optional(ViewTypeSchema),
  filters: Schema.optional(ViewFiltersSchema),
  sorts: Schema.optional(Schema.Array(ViewSortSchema)),
  fields: Schema.optional(Schema.Array(ViewFieldConfigSchema)),
  groupBy: Schema.optional(ViewGroupBySchema),
  permissions: Schema.optional(ViewPermissionsSchema),
}).pipe(
  Schema.annotations({
    title: 'View',
    description:
      'A saved view configuration for a table. Views define how records are displayed, filtered, sorted, and grouped.',
    examples: [
      {
        id: 1,
        name: 'All Records',
        type: 'grid' as const,
      },
      {
        id: 2,
        name: 'Active Tasks',
        type: 'kanban' as const,
        groupBy: { field: 'status' },
        filters: {
          conjunction: 'and' as const,
          conditions: [{ field: 'completed', operator: 'equals', value: false }],
        },
      },
      {
        id: 'calendar-view',
        name: 'Schedule',
        type: 'calendar' as const,
        sorts: [{ field: 'dueDate', direction: 'asc' as const }],
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
export * from './type'
export * from './filters'
export * from './sorts'
export * from './fields'
export * from './group-by'
export * from './permissions'
