/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CommandGroupSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const CommandTypeLiteral = Schema.Literal('command')

export const commandFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  commandGroups: Schema.optional(
    Schema.Array(CommandGroupSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Groups of commands in the command palette' })
    )
  ),
} as const
