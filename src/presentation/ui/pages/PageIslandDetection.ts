/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { someComponentInTree } from '@/presentation/utils/component-template-walker'
import { ISLAND_COMPONENT_TYPES } from '@/presentation/utils/island-component-types'
import { isListIslandMode } from '@/presentation/utils/list-island-mode'
import { isRecordFieldSystemMode } from '@/presentation/utils/system-detail-mode'
import type { Components } from '@/domain/models/app/components'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Island-runtime detection for DynamicPage: decides whether a page needs the
 * React island entry bundle injected. Extracted from DynamicPage.tsx (which
 * sits at its max-lines cap) — consumed solely by its body renderer.
 *
 * Checks if a single component (or any of its descendants) requires the
 * React island runtime. Recursively descends into `children` so nested
 * data-tables and other islands are detected when wrapped in containers.
 */
const ISLAND_ACTION_TYPES = new Set(['auth', 'crud', 'automation'])

/**
 * PG-04: a `form` / `data-form` bound to a single-record dataSource has a
 * synthesized CRUD update action injected at render time
 * (`maybeSynthesizeCrudUpdateAction` in `interactive-renderers.tsx`).
 * The `<script src="/assets/islands/...">` tag must be emitted so the
 * hydrated `crud-form` island intercepts Save submissions.
 */
function isSingleRecordBoundForm(item: Component): boolean {
  return (
    (item.type === 'form' || item.type === 'data-form') &&
    item.dataSource?.mode === 'single' &&
    typeof item.dataSource.table === 'string'
  )
}

/**
 * True when a component carries an explicit `data-island="<type>"` marker in its
 * `props` — the render-time island-injection pattern used by surfaces that mount
 * an island onto a generic `container` rather than authoring a dedicated island
 * component-type (e.g. the admin dashboard's `admin-sidebar`). The marker only
 * hydrates if the page-level island runtime script is injected, so its presence
 * must make `hasIslandComponents()` true.
 */
function hasDataIslandProp(item: Component): boolean {
  const props = (item as Record<string, unknown>).props as Record<string, unknown> | undefined
  return typeof props?.['data-island'] === 'string'
}

function itemSelfNeedsIslands(item: Component): boolean {
  if (ISLAND_COMPONENT_TYPES.has(item.type)) return true
  if (hasDataIslandProp(item)) return true
  if (item.dataSource?.mode === 'search') return true
  // CAP-1: a client-fetching data-bound list hydrates the `list` island —
  // inject its hydration <script> (mirror of render-page's selfNeedsIslands).
  if (isListIslandMode(item)) return true
  // CAP-2: a record-field self-binding to a system detail endpoint hydrates the
  // `record-field-system` island — inject its hydration <script>.
  if (isRecordFieldSystemMode(item)) return true
  if (isSingleRecordBoundForm(item)) return true
  const action = (item as Record<string, unknown>).action as { type?: string } | undefined
  return action?.type !== undefined && ISLAND_ACTION_TYPES.has(action.type)
}

/**
 * Checks if a page has components that require the React island runtime.
 *
 * Island components are rendered as placeholders on the server and
 * hydrated with interactive React components on the client.
 * Also detects list components in search mode, which use the search-list island.
 *
 * Descends into referenced `app.components` templates (via `someComponentInTree`)
 * so a shared site-header template hosting islands (e.g. a `dropdown-menu` CTA)
 * triggers the same script injection as page-direct authoring — the walker also
 * handles child recursion, replacing the former hand-rolled `itemNeedsIslands`.
 *
 * A page with `presence: true` (Wave-6) always needs the runtime so the
 * page-level `presence-indicator` island can hydrate, even when the page has
 * no other island components.
 */
export function hasIslandComponents(page: Page, components?: Components): boolean {
  if (page.presence === true) return true
  return someComponentInTree(page.components, components, (item) =>
    itemSelfNeedsIslands(item as Component)
  )
}
