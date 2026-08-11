/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * True when a `list` component renders its items CLIENT-side via the `list`
 * island (CAP-1) rather than the server-side SSR-expand path.
 *
 * Trigger: a `list` with a `dataSource` binding (DB table OR system read
 * endpoint) AND a `listDisplay.itemTemplate` AND NOT in search/single mode.
 * Search mode keeps the separate `search-list` island; single mode is a
 * record-detail binding.
 *
 * Shared by THREE call-sites that must agree (otherwise the island bundle is
 * built without a script tag, or vice-versa):
 *  - the data-source resolver (stamps the `_listIslandMode` island props and
 *    skips server-side resolution / pre-fetch for the binding);
 *  - the page renderer's `selfNeedsIslands` (BUILD the island bundle);
 *  - `DynamicPage`'s island detection (INJECT the hydration `<script>`).
 */
export function isListIslandMode(component: Component): boolean {
  if (component.type !== 'list') return false
  const { dataSource } = component
  if (!dataSource) return false
  const { mode } = dataSource as { mode?: string }
  if (mode === 'search' || mode === 'single') return false
  const { listDisplay } = component as { listDisplay?: { itemTemplate?: unknown } }
  return listDisplay?.itemTemplate !== undefined
}
