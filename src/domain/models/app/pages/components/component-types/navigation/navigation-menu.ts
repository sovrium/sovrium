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
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({ description: 'Navigation items with optional sub-menus' })
    )
  ),
  /**
   * When true, a mega-menu trigger opens on pointer hover (in addition to
   * click). Click always still opens/closes the menu; hover is purely additive.
   * The pointer can travel from the trigger into the open panel without the menu
   * closing. Applies to every mega-menu trigger in this navigation-menu.
   */
  openOnHover: Schema.optional(
    Schema.Boolean.annotate({
      description:
        'Open a mega-menu trigger on pointer hover in addition to click (click still opens/closes; the pointer may travel from the trigger into the open panel without it closing). Applies to every mega-menu trigger in this navigation-menu.',
    })
  ),
  /**
   * Authored className for the navigation-menu trigger. When present, it
   * OVERRIDES the platform default trigger recipe (`computeNavMenuTriggerClasses`)
   * for both the hydrated island trigger AND the SSR placeholder trigger, so the
   * two emit an identical class list and hydration does not reflow the header.
   * When omitted, the default recipe is used unchanged (other apps unaffected).
   */
  triggerClassName: Schema.optional(
    Schema.String.annotate({
      description:
        'Authored className for the navigation-menu trigger; overrides the default trigger recipe on BOTH the SSR placeholder and the hydrated island (identical class list → no hydration reflow). Omit to keep the platform default trigger styling.',
    })
  ),
} as const
