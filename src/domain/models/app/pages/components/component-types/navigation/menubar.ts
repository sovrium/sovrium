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
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const MenubarTypeLiteral = Schema.Literal('menubar')

export const menubarFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  menus: Schema.optional(
    Schema.Array(
      Schema.Struct({
        label: Schema.String.annotations({ description: 'Menu group label' }),
        items: Schema.Array(MenuItemSchema).pipe(
          Schema.minItems(1),
          Schema.annotations({ description: 'Items in this menu group' })
        ),
      })
    ).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Top-level menu groups in the menubar' })
    )
  ),
} as const
