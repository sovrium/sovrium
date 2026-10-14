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

export const EmptyStateTypeLiteral = Schema.Literal('empty')

export const emptyStateFields = {
  ...coreFields,
  ...contentFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  emptyIcon: Schema.optional(
    Schema.String.annotate({
      description:
        'A Lucide icon drawn above the title. Decorative: hidden from assistive technology.',
    })
  ),
  emptyMedia: Schema.optional(
    Schema.Literals(['icon', 'default']).annotate({
      title: 'Empty Media',
      defaultNote: 'icon',
      description:
        "How the `emptyIcon` is drawn: 'icon' (the default here) frames it in a small tile, 'default' draws it bare. shadcn/ui's EmptyMedia variant, whose own default is 'default'.",
    })
  ),
  emptyTitle: Schema.optional(
    Schema.String.annotate({ description: 'Title text displayed in the empty component' })
  ),
  emptyDescription: Schema.optional(
    Schema.String.annotate({
      description: 'Description text displayed below the empty title',
    })
  ),
} as const
