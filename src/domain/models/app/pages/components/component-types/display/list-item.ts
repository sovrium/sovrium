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
import { interactionFields } from '../modules/interaction'
import { visibilityFields } from '../modules/visibility'

export const ListItemTypeLiteral = Schema.Literal('item')

export const listItemFields = {
  ...coreFields,
  ...contentFields,
  ...interactionFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  title: Schema.optional(
    Schema.String.annotate({
      title: 'Title',
      description: "The item's title line, beside its media. A `$t:` key is translated.",
    })
  ),
  description: Schema.optional(
    Schema.String.annotate({
      title: 'Description',
      description: 'The line under the title, in the muted tone. A `$t:` key is translated.',
    })
  ),
  itemVariant: Schema.optional(
    Schema.Literals(['default', 'outline', 'muted']).annotate({
      title: 'Item Variant',
      defaultNote: 'default',
      description:
        "'default' (no border, no ground), 'outline' (a border) or 'muted' (a muted ground). shadcn/ui's Item variant.",
    })
  ),
  itemSize: Schema.optional(
    Schema.Literals(['default', 'sm']).annotate({
      title: 'Item Size',
      defaultNote: 'default',
      description: "'default', or 'sm' for a shorter row. shadcn/ui's Item size.",
    })
  ),
} as const
