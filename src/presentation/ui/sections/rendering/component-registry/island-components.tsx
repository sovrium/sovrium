/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { islandDataComponents } from './island-data-components'
import { islandEditorComponents } from './island-editor-components'
import { islandFormComponents } from './island-form-components'
import { islandOverlayComponents } from './island-overlay-components'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'

/**
 * Island components — SSR placeholders for client-side React islands.
 *
 * These renderers output `<div data-island="..." data-island-props="...">` markers
 * with loading skeletons. The island client script discovers these markers
 * and mounts interactive React components into them.
 *
 * The loading skeleton is preserved as a Suspense fallback during lazy loading.
 *
 * Split into three sub-modules by concern:
 * - island-data-components: data-table, dropdown
 * - island-overlay-components: dialog, alert-dialog, modal, tooltip, popover, drawer, dropdown-menu, context-menu
 * - island-form-components: select, checkbox, radio-group, switch, slider, toggle, toggle-group, accordion, tabs, menubar, navigation-menu, scroll-area
 * - island-editor-components: schema-json-editor, schema-yaml-editor
 */
export const islandComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  ...islandDataComponents,
  ...islandOverlayComponents,
  ...islandFormComponents,
  ...islandEditorComponents,
}
