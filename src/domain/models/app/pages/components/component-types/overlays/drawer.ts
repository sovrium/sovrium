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
  /**
   * Component identifier — referenced by an `onRowClick.action: 'openDrawer'`
   * dispatch (PG-04 quick-edit drawer pattern). Authors set `id` at the
   * top level (sibling of `type` / `props`) so the cross-component reference
   * reads naturally:
   *
   *   { type: 'data-table', onRowClick: { action: 'openDrawer', component: 'record-detail' } }
   *   { type: 'drawer', id: 'record-detail', children: [...] }
   *
   * The render-time `resolveOpenDrawerDispatches` pass tags any drawer
   * referenced this way so the hydrated island defaults to `open=false`.
   */
  id: Schema.optional(
    Schema.String.annotate({
      description:
        "Drawer identifier referenced by `onRowClick: { action: 'openDrawer', component: <id> }` (PG-04).",
    })
  ),
  drawerSide: Schema.optional(DrawerSideSchema),
  drawerSize: Schema.optional(DrawerSizeSchema),
} as const
