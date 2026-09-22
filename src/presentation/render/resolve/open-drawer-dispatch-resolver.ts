/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Open-Drawer Dispatch Resolver (PG-04)
 *
 * Walks a page's component tree once and identifies any drawer whose `id` is
 * referenced by a sibling component's `onRowClick.action === 'openDrawer'`
 * (the "quick-edit drawer" pattern). Each referenced drawer is tagged with a
 * render-time-only `_openDrawerDispatchedById: <id>` prop. The drawer's
 * island-props builder reads this flag and emits `defaultOpen: false` to the
 * hydrated island so the drawer remains hidden on page load and opens only in
 * response to the dispatched `sovrium:open-drawer` CustomEvent fired by the
 * data-table island when a row is clicked.
 *
 * Drawers that are NOT referenced by an `openDrawer` action keep the legacy
 * default-open contract — the pre-hydration `data-click-modal` click handler
 * still relies on it.
 *
 * This pass is intentionally non-mutating at the tree level: it returns a new
 * `Component[]` with the `props` object replaced on matched drawers; all
 * other branches are preserved by reference.
 */

import type { Component } from '@/domain/models/app/pages/components'

interface OpenDrawerOnRowClick {
  readonly action: 'openDrawer'
  readonly component: string
}

function isOpenDrawerAction(value: unknown): value is OpenDrawerOnRowClick {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record['action'] === 'openDrawer' && typeof record['component'] === 'string'
}

/** Recursively collect every drawer-id referenced by `onRowClick: { action: 'openDrawer', component }` in the subtree rooted at `component`. */
function collectIdsFromComponent(component: Component | string): readonly string[] {
  if (typeof component === 'string') return []
  const { onRowClick, children } = component as unknown as Record<string, unknown>
  const selfId = isOpenDrawerAction(onRowClick) ? [onRowClick.component] : []
  if (!Array.isArray(children)) return selfId
  const childIds = (children as readonly (Component | string)[]).flatMap(collectIdsFromComponent)
  return [...selfId, ...childIds]
}

/** Collect every drawer-id referenced by an `onRowClick: { action: 'openDrawer', component }` somewhere in the tree. */
function collectDispatchedDrawerIds(components: readonly Component[]): ReadonlySet<string> {
  return new Set(components.flatMap(collectIdsFromComponent))
}

/** Tag a drawer (if matched) with the render-time `_openDrawerDispatchedById` prop. */
function tagDrawerIfDispatched(
  component: Component,
  dispatchedIds: ReadonlySet<string>
): Component {
  const { type, id, props } = component as unknown as Record<string, unknown>
  if (type !== 'drawer') return component
  if (typeof id !== 'string' || !dispatchedIds.has(id)) return component
  const existingProps = (props as Record<string, unknown> | undefined) ?? {}
  return {
    ...component,
    props: { ...existingProps, _openDrawerDispatchedById: id },
  } as Component
}

/** Recursively map components, tagging dispatched drawers and recursing into children. */
function mapTree(
  components: readonly Component[],
  dispatchedIds: ReadonlySet<string>
): Component[] {
  return components.map((component) => {
    const tagged = tagDrawerIfDispatched(component, dispatchedIds)
    const { children } = tagged as unknown as Record<string, unknown>
    if (!Array.isArray(children)) return tagged
    const mappedChildren = mapTree(children as readonly Component[], dispatchedIds)
    return { ...tagged, children: mappedChildren } as Component
  })
}

/**
 * Entry point — collect dispatched drawer ids in a single pre-pass, then walk
 * the tree once tagging any matching drawer. Returns a new array when at least
 * one drawer was tagged; otherwise returns the original reference unchanged.
 */
export function resolveOpenDrawerDispatches(
  components: readonly Component[]
): readonly Component[] {
  const dispatchedIds = collectDispatchedDrawerIds(components)
  if (dispatchedIds.size === 0) return components
  return mapTree(components, dispatchedIds)
}
