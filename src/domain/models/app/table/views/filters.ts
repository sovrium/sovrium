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
 * View Filters Schema
 *
 * Filter configuration for the view. Combines multiple conditions with AND/OR logic.
 *
 * @example
 * ```typescript
 * {
 *   conjunction: 'and',
 *   conditions: [
 *     { field: 'status', operator: 'equals', value: 'active' },
 *     { field: 'archived', operator: 'equals', value: false }
 *   ]
 * }
 * ```
 */
export const ViewFiltersSchema = Schema.Struct({
  conjunction: Schema.optional(Schema.Literal('and', 'or')),
  conditions: Schema.optional(Schema.Array(ViewFilterConditionSchema)),
}).pipe(
  Schema.annotations({
    title: 'View Filters',
    description: 'Filter configuration combining multiple conditions with AND/OR logic.',
  })
)

export type ViewFilters = Schema.Schema.Type<typeof ViewFiltersSchema>
