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
 * (the "quick-edit drawer" pattern), or a board's `card.onClick` or a
 * gallery's `galleryCard.onClick` of that shape. Each referenced drawer is
 * tagged with a render-time-only `_openDrawerDispatchedById: <id>` prop. The
 * drawer's island-props builder reads this flag and emits `defaultOpen: false`
 * to the hydrated island so the drawer remains hidden on page load and opens
 * only in response to the dispatched `sovrium:open-drawer` CustomEvent fired
 * when a row (or a board or gallery card) is clicked.
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

/**
 * The drawer ids a drawer's `related.onRowClick` opens ([internal ref]
 * CAP-8). Collected apart from the grid references: a drawer reached ONLY this
 * way is secondary on its page, and must not self-open on the page's
 * `?record=` deep link (see {@link tagDrawerIfDispatched}).
 */
function collectRelatedRowTargets(component: Component | string): readonly string[] {
  if (typeof component === 'string') return []
  const { type, related, children } = component as unknown as Record<string, unknown>
  const own =
    type === 'drawer' && Array.isArray(related)
      ? related.flatMap((entry: unknown) => {
          const onRowClick = (entry as Record<string, unknown> | null)?.['onRowClick']
          return isOpenDrawerAction(onRowClick) ? [onRowClick.component] : []
        })
      : []
  if (!Array.isArray(children)) return own
  return [
    ...own,
    ...(children as readonly (Component | string)[]).flatMap(collectRelatedRowTargets),
  ]
}

/**
 * The drawer a board's or a gallery's cards open, when `card.onClick` (or
 * `galleryCard.onClick`) is an `openDrawer` — the same verb a grid row click
 * takes, so its drawer starts closed the same way.
 */
function cardClickTarget(card: unknown): readonly string[] {
  const onClick = (card as Record<string, unknown> | null | undefined)?.['onClick']
  return isOpenDrawerAction(onClick) ? [onClick.component] : []
}

/** Recursively collect every drawer-id referenced by `onRowClick: { action: 'openDrawer', component }` (or a board's `card.onClick`, a gallery's `galleryCard.onClick`) in the subtree rooted at `component`. */
function collectIdsFromComponent(component: Component | string): readonly string[] {
  if (typeof component === 'string') return []
  const { onRowClick, card, galleryCard, children } = component as unknown as Record<
    string,
    unknown
  >
  const selfId = [
    ...(isOpenDrawerAction(onRowClick) ? [onRowClick.component] : []),
    ...cardClickTarget(card),
    ...cardClickTarget(galleryCard),
  ]
  if (!Array.isArray(children)) return selfId
  const childIds = (children as readonly (Component | string)[]).flatMap(collectIdsFromComponent)
  return [...selfId, ...childIds]
}

/** Collect every drawer-id referenced by an `onRowClick: { action: 'openDrawer', component }` somewhere in the tree. */
function collectDispatchedDrawerIds(components: readonly Component[]): ReadonlySet<string> {
  return new Set(components.flatMap(collectIdsFromComponent))
}

/** The two kinds of dispatch a drawer can be the target of. */
interface DispatchTargets {
  /** Ids a grid's `onRowClick: openDrawer` names. */
  readonly grid: ReadonlySet<string>
  /** Ids a drawer's `related[].onRowClick: openDrawer` names. */
  readonly relatedRow: ReadonlySet<string>
}

/**
 * Tag a drawer (if matched) with the render-time `_openDrawerDispatchedById`
 * prop, and — when a related row is the ONLY thing that opens it — with
 * `_relatedRowTargetOnly`, which keeps it from self-opening on the page's
 * `?record=` deep link: that id belongs to the page's own table, and opening
 * a contact drawer on a company's id shows the wrong record.
 */
function tagDrawerIfDispatched(component: Component, targets: DispatchTargets): Component {
  const { type, id, props } = component as unknown as Record<string, unknown>
  if (type !== 'drawer' || typeof id !== 'string') return component
  const fromGrid = targets.grid.has(id)
  const fromRelatedRow = targets.relatedRow.has(id)
  if (!fromGrid && !fromRelatedRow) return component
  const existingProps = (props as Record<string, unknown> | undefined) ?? {}
  return {
    ...component,
    props: {
      ...existingProps,
      _openDrawerDispatchedById: id,
      ...(fromGrid ? {} : { _relatedRowTargetOnly: true }),
    },
  } as Component
}

/** Recursively map components, tagging dispatched drawers and recursing into children. */
function mapTree(components: readonly Component[], targets: DispatchTargets): Component[] {
  return components.map((component) => {
    const tagged = tagDrawerIfDispatched(component, targets)
    const { children } = tagged as unknown as Record<string, unknown>
    if (!Array.isArray(children)) return tagged
    const mappedChildren = mapTree(children as readonly Component[], targets)
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
  const grid = collectDispatchedDrawerIds(components)
  const relatedRow = new Set(components.flatMap(collectRelatedRowTargets))
  if (grid.size === 0 && relatedRow.size === 0) return components
  return mapTree(components, { grid, relatedRow })
}
