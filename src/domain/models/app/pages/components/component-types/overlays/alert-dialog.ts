/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { actionFields } from '../modules/action'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const AlertDialogTypeLiteral = Schema.Literal('alert-dialog')

export const alertDialogFields = {
  ...coreFields,
  ...contentFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  cancelLabel: Schema.optional(
    Schema.String.annotate({ description: 'Cancel button text (default: "Cancel")' })
  ),
  confirmLabel: Schema.optional(
    Schema.String.annotate({ description: 'Confirm button text (default: "Continue")' })
  ),
  /**
   * Typed confirmation: the confirm button stays disabled until the reader has
   * typed exactly this text into the field the dialog then draws. For the
   * irreversible actions — deleting an account, a workspace — where a click is
   * too cheap a confirmation. Usually a value the reader knows by heart
   * (`$session.email`, `$record.name`) rather than a fixed word.
   */
  confirmText: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Text the reader must type before the confirm button enables, for irreversible actions. Accepts $session.<field> and $record.<field>; compared exactly, ignoring surrounding spaces.',
        examples: ['$session.email', '$record.name', 'DELETE'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
} as const
