/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View ID Schema
 *
 * Unique identifier for a view. Can be either a numeric ID or a string identifier.
 *
 * @example
 * ```typescript
 * 1
 * 'default-view'
 * 'kanban-view'
 * ```
 */
export const ViewIdSchema = Schema.Union(Schema.Number, Schema.String).pipe(
  Schema.annotations({
    title: 'View ID',
    description: 'Unique identifier for the view. Can be a number or string.',
    examples: [1, 2, 'default', 'kanban-view'],
  })
)

export type ViewId = Schema.Schema.Type<typeof ViewIdSchema>
