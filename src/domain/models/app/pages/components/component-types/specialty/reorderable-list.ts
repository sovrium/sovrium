/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../action'
import { actionFields } from '../modules/action'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ReorderableListTypeLiteral = Schema.Literal('reorderable-list')

export const reorderableListFields = {
  ...coreFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  reorderable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable drag-and-drop reordering of list items',
    })
  ),
  onReorder: Schema.optional(ActionSchema),
} as const
