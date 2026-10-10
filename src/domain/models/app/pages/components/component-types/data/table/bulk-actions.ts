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
 *   - label: Delete
 *     action:
 *       type: crud
 *       operation: delete
 *       table: orders
 *     confirm:
 *       message: "Delete {count} orders?"
 *       confirmLabel: Delete
 *       cancelLabel: Keep
 * ```
 */
/**
 * The object form of a bulk action's confirmation: the prompt plus the two
 * button labels. The field names are the ones a row or button `confirm` object
 * already uses (`message`, `confirmLabel`, `cancelLabel`), so an author writes
 * the same words in both places. It carries only those three: the selection bar
 * asks inline, so a separate title, a dialog role or a type-to-confirm input
 * would have nothing to draw them.
 */
export const DataTableBulkActionConfirmSchema = Schema.Struct({
  message: Schema.String.annotate({
    description:
      'Confirmation prompt shown beside the selection count. Supports {count} for the number of selected rows.',
    examples: ['Delete {count} orders?'],
  }),
  confirmLabel: Schema.optional(
    Schema.String.annotate({
      description:
        "Label of the button that runs the action. Defaults to the language-resolved 'Confirm' ('Confirmer' in French).",
      examples: ['Delete', 'Mark shipped'],
    })
  ),
  cancelLabel: Schema.optional(
    Schema.String.annotate({
      description:
        "Label of the button that dismisses the prompt. Defaults to the language-resolved 'Cancel' ('Annuler' in French).",
      examples: ['Keep', 'Not now'],
    })
  ),
}).annotate({
  title: 'Bulk Action Confirm',
  description:
    'A bulk action confirmation with its own button labels: a message (supports {count}) plus optional confirmLabel and cancelLabel.',
})

export const DataTableBulkActionSchema = Schema.Struct({
  /** Button label */
  label: Schema.String.annotate({ description: 'Bulk action button label' }),
  /** Optional icon name */
  icon: Schema.optional(Schema.String.annotate({ description: 'Icon name (e.g., truck, trash)' })),
  /** Action to execute on selected rows */
  action: ActionSchema,
  /**
   * Confirmation before the action runs. A string is the prompt (supports
   * {count}) answered by a "Confirm" button; the object form adds the button
   * labels.
   */
  confirm: Schema.optional(
    Schema.Union([
      Schema.String.annotate({
        description: 'Confirmation prompt. Supports {count} for number of selected rows.',
        examples: ['Delete {count} orders?', 'Mark {count} items as shipped?'],
      }),
      DataTableBulkActionConfirmSchema,
    ]).annotate({
      description:
        'Confirmation before the action runs: a prompt string (supports {count}), or an object with a message and its own confirmLabel / cancelLabel.',
    })
  ),
}).annotate({
  title: 'Bulk Action',
  description: 'Action that operates on multiple selected rows',
})

/** @public */
export type DataTableBulkActionConfirm = Schema.Schema.Type<typeof DataTableBulkActionConfirmSchema>

export type DataTableBulkAction = Schema.Schema.Type<typeof DataTableBulkActionSchema>
