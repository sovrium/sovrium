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

export const EmptyStateTypeLiteral = Schema.Literal('empty-state')

export const emptyStateFields = {
  ...coreFields,
  ...contentFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  emptyIcon: Schema.optional(
    Schema.String.annotations({ description: 'Lucide icon name for empty state illustration' })
  ),
  emptyTitle: Schema.optional(
    Schema.String.annotations({ description: 'Title text displayed in empty state' })
  ),
  emptyDescription: Schema.optional(
    Schema.String.annotations({
      description: 'Description text displayed below the empty state title',
    })
  ),
} as const
