/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { NavItemSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const NavigationMenuTypeLiteral = Schema.Literal('navigation-menu')

export const navigationMenuFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  navItems: Schema.optional(
    Schema.Array(NavItemSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Navigation items with optional sub-menus' })
    )
  ),
  openOnHover: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'Open a mega-menu trigger on pointer hover in addition to click (click still opens/closes; the pointer may travel from the trigger into the open panel without it closing). Applies to every mega-menu trigger in this navigation-menu.',
    })
  ),
  triggerClassName: Schema.optional(
    Schema.String.annotations({
      description:
        'Authored className for the navigation-menu trigger; overrides the default trigger recipe on BOTH the SSR placeholder and the hydrated island (identical class list → no hydration reflow). Omit to keep the platform default trigger styling.',
    })
  ),
} as const
