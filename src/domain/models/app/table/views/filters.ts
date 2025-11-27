/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View Filter Condition Schema
 *
 * A single filter condition for filtering records.
 *
 * @example
 * ```typescript
 * { field: 'status', operator: 'equals', value: 'active' }
 * { field: 'age', operator: 'greaterThan', value: 18 }
 * ```
 */
export const ViewFilterConditionSchema = Schema.Struct({
  field: Schema.String,
  operator: Schema.String,
  value: Schema.Unknown,
}).pipe(
  Schema.annotations({
    title: 'Filter Condition',
    description: 'A single filter condition specifying field, operator, and value.',
  })
)

export type ViewFilterCondition = Schema.Schema.Type<typeof ViewFilterConditionSchema>

/**
 * View Filter Node
 *
 * Recursive type for filter expressions. Can be either:
 * - A condition: `{ field, operator, value }`
 * - An AND group: `{ and: [...] }`
 * - An OR group: `{ or: [...] }`
 */
export type ViewFilterNode =
  | ViewFilterCondition
  | { readonly and: ReadonlyArray<ViewFilterNode> }
  | { readonly or: ReadonlyArray<ViewFilterNode> }

/**
 * View Filter Node Schema
 *
 * Recursive schema for nested filter expressions.
 * Uses a simple `{ and: [...] }` or `{ or: [...] }` format.
 *
 * @example Simple condition
 * ```typescript
 * { field: 'status', operator: 'equals', value: 'active' }
 * ```
 *
 * @example AND group
 * ```typescript
 * {
 *   and: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     { field: 'archived', operator: 'equals', value: false }
 *   ]
 * }
 * ```
 *
 * @example Nested groups (Prisma/MongoDB style)
 * ```typescript
 * // (status = 'active') AND ((priority = 'high') OR (priority = 'urgent'))
 * {
 *   and: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     {
 *       or: [
 *         { field: 'priority', operator: 'equals', value: 'high' },
 *         { field: 'priority', operator: 'equals', value: 'urgent' }
 *       ]
 *     }
 *   ]
 * }
 * ```
 *
 * @example Complex nested logic
 * ```typescript
 * {
 *   or: [
 *     {
 *       and: [
 *         { field: 'type', operator: 'equals', value: 'task' },
 *         { field: 'status', operator: 'equals', value: 'completed' }
 *       ]
 *     },
 *     {
 *       and: [
 *         { field: 'type', operator: 'equals', value: 'bug' },
 *         { field: 'severity', operator: 'equals', value: 'critical' }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
export const ViewFilterNodeSchema: Schema.Schema<ViewFilterNode> = Schema.Union(
  ViewFilterConditionSchema,
  Schema.Struct({
    and: Schema.Array(Schema.suspend((): Schema.Schema<ViewFilterNode> => ViewFilterNodeSchema)),
  }),
  Schema.Struct({
    or: Schema.Array(Schema.suspend((): Schema.Schema<ViewFilterNode> => ViewFilterNodeSchema)),
  })
).pipe(
  Schema.annotations({
    title: 'Filter Node',
    description: 'A filter condition or a logical group (and/or) of filter nodes.',
  })
)

/**
 * View Filters Schema
 *
 * Root filter configuration for views. Can be a single condition or a logical group.
 *
 * @example Single condition (implicit)
 * ```typescript
 * { field: 'status', operator: 'equals', value: 'active' }
 * ```
 *
 * @example Multiple conditions with AND
 * ```typescript
 * {
 *   and: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     { field: 'archived', operator: 'equals', value: false }
 *   ]
 * }
 * ```
 *
 * @example Complex nested filters
 * ```typescript
 * {
 *   and: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     {
 *       or: [
 *         { field: 'priority', operator: 'equals', value: 'high' },
 *         { field: 'priority', operator: 'equals', value: 'urgent' }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */
export const ViewFiltersSchema = ViewFilterNodeSchema.pipe(
  Schema.annotations({
    title: 'View Filters',
    description: 'Filter configuration using nested and/or groups.',
  })
)

export type ViewFilters = Schema.Schema.Type<typeof ViewFiltersSchema>
