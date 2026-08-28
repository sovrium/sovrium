/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * View Name Schema
 *
 * Human-readable name for the view.
 *
 * @example
 * ```typescript
 * 'All Records'
 * 'Active Tasks'
 * 'Completed Orders'
 * ```
 */
export const ViewNameSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
  Schema.annotate({
    title: 'View Name',
    description: 'Human-readable name for the view. Must be non-empty.',
    examples: ['All Records', 'Active Tasks', 'Completed Orders'],
  })
)

/** @public */
export type ViewName = Schema.Schema.Type<typeof ViewNameSchema>
