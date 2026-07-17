/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { MenuItemSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const DropdownMenuTypeLiteral = Schema.Literal('dropdown-menu')

export const dropdownMenuFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  triggerLabel: Schema.optional(
    Schema.String.annotations({
      description: 'Text displayed on the trigger button. Defaults to "Menu" if omitted.',
    })
  ),
  popupVariant: Schema.optional(
    Schema.Literal('default', 'inverted').annotations({
      description:
        'Visual tone of the dropdown popup surface. "inverted" renders a dark surface with light text so the menu matches a near-black primary CTA trigger; "default" (or omitted) keeps the light surface.',
    })
  ),
  openOnHover: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'Open the dropdown trigger on pointer hover in addition to click (click still opens/closes; the pointer may travel from the trigger into the open popup without it closing).',
    })
  ),
  menuItems: Schema.optional(
    Schema.Array(MenuItemSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Menu items for dropdown-menu' })
    )
  ),
} as const
