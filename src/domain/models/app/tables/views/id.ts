/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const ViewIdStringSchema = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9_-]+$/, {
    message: () => 'must be one of the allowed values',
  }),
  Schema.annotations({
    description: 'View ID as string (lowercase, numbers, underscores, hyphens only)',
  })
)

export const ViewIdSchema = Schema.Union(Schema.Number, ViewIdStringSchema).pipe(
  Schema.annotations({
    title: 'View ID',
    description:
      'Unique identifier for the view. Can be a number or string (lowercase, numbers, underscores, hyphens only).',
    examples: [1, 2, 'default', 'kanban_view'],
  })
)

export type ViewId = Schema.Schema.Type<typeof ViewIdSchema>
