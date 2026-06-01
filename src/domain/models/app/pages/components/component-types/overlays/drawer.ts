/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DrawerSideSchema, DrawerSizeSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const DrawerTypeLiteral = Schema.Literal('drawer')

export const drawerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  id: Schema.optional(
    Schema.String.annotations({
      description:
        "Drawer identifier referenced by `onRowClick: { action: 'openDrawer', component: <id> }` (PG-04).",
    })
  ),
  drawerSide: Schema.optional(DrawerSideSchema),
  drawerSize: Schema.optional(DrawerSizeSchema),
} as const
