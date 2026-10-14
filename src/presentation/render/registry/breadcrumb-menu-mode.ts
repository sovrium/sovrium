/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * True when a `breadcrumb` collapses its middle crumbs into a MENU — the
 * `dropdown-menu` island mounted in the ellipsis's place.
 *
 * Shared by the two call-sites that must agree, as `isSourcedSidebar` is: the
 * page renderer's `selfNeedsIslands` (BUILD the bundle) and
 * `PageIslandDetection`'s `itemSelfNeedsIslands` (INJECT the script). A trail
 * short enough to need no collapsing still counts: the decision is about the
 * page's shape, not about how many crumbs one request resolves.
 */
export function isMenuBreadcrumb(component: Component): boolean {
  if (component.type !== 'breadcrumb') return false
  const { collapse, maxItems } = component as { collapse?: unknown; maxItems?: unknown }
  return collapse === 'menu' && typeof maxItems === 'number'
}
