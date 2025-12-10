/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Valid View ID String Pattern
 *
 * String view IDs must follow snake_case or kebab-case pattern:
 * - Only lowercase letters (a-z)
 * - Numbers (0-9)
 * - Underscores (_) and hyphens (-)
 * - No spaces, no uppercase letters
 */
const ViewIdStringSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9_-]+$/, {
    message: () => 'must be one of the allowed values',
  }),
  Schema.annotations({
    description: 'View ID as string (lowercase, numbers, underscores, hyphens only)',
  })
)

/**
 * View ID Schema
 *
 * Unique identifier for a view. Can be either a numeric ID or a string identifier.
 * String IDs must follow snake_case or kebab-case pattern (lowercase, numbers, underscores, hyphens only).
 *
 * @example
 * ```typescript
 * 1
 * 'default_view'
 * 'kanban-view'
 * ```
 */
export const ViewIdSchema = Schema.Union(Schema.Number, ViewIdStringSchema).pipe(
  Schema.annotations({
    title: 'View ID',
    description:
      'Unique identifier for the view. Can be a number or string (lowercase, numbers, underscores, hyphens only).',
    examples: [1, 2, 'default', 'kanban_view'],
  })
)

export type ViewId = Schema.Schema.Type<typeof ViewIdSchema>
