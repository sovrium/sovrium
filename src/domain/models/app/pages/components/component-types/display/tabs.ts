/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TabsOrientationSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const TabsTypeLiteral = Schema.Literal('tabs')

export const tabsFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  tabsOrientation: Schema.optional(TabsOrientationSchema),
  defaultTab: Schema.optional(
    Schema.String.annotations({ description: 'ID of the tab that is active by default' })
  ),
} as const
