/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../../action'

/**
 * Bulk action that operates on selected rows.
 *
 * @example
 * ```yaml
 * bulkActions:
 *   - label: Mark Shipped
 *     icon: truck
 *     action:
 *       type: crud
 *       operation: update
 *       table: orders
 *     confirm: "Mark {count} orders as shipped?"
 * ```
 */
export const DataTableBulkActionSchema = Schema.Struct({
  /** Button label */
  label: Schema.String.annotations({ description: 'Bulk action button label' }),
  /** Optional icon name */
  icon: Schema.optional(
    Schema.String.annotations({ description: 'Icon name (e.g., truck, trash)' })
  ),
  /** Action to execute on selected rows */
  action: ActionSchema,
  /** Confirmation prompt. Supports {count} placeholder. */
  confirm: Schema.optional(
    Schema.String.annotations({
      description: 'Confirmation dialog. Supports {count} for number of selected rows.',
      examples: ['Delete {count} orders?', 'Mark {count} items as shipped?'],
    })
  ),
}).annotations({
  title: 'Bulk Action',
  description: 'Action that operates on multiple selected rows',
})

export type DataTableBulkAction = Schema.Schema.Type<typeof DataTableBulkActionSchema>
