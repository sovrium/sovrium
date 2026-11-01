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
 * referenced by a sibling component's `onRowClick.action === 'openSheet'`
 * (the "quick-edit drawer" pattern), or a board's `card.onClick` or a
 * gallery's `galleryCard.onClick` of that shape, or a board's drop hook
 * (`drag.onDrop[].action`). Each referenced drawer is
 * tagged with a render-time-only `_openDrawerDispatchedById: <id>` prop. The
 * drawer's island-props builder reads this flag and emits `defaultOpen: false`
 * to the hydrated island so the drawer remains hidden on page load and opens
 * only in response to the dispatched `sovrium:open-drawer` CustomEvent fired
 * when a row (or a board or gallery card) is clicked.
 *
 * Drawers that are NOT referenced by an `openSheet` action keep the legacy
 * default-open contract — the pre-hydration `data-click-modal` click handler
 * still relies on it.
 *
 * This pass is intentionally non-mutating at the tree level: it returns a new
 * `Component[]` with the `props` object replaced on matched drawers; all
 * other branches are preserved by reference.
 */

import {
  componentFields,
  entryAsComponent,
  keyOf,
  rewriteComponent,
  type ComponentEntry,
  type ComponentNode,
} from './component-rewrite'
import type { Component } from '@/domain/models/app/pages/components'

interface OpenDrawerOnRowClick {
  readonly action: 'openSheet'
  readonly component: string
}

function isOpenDrawerAction(value: unknown): value is OpenDrawerOnRowClick {
  if (typeof value !== 'object' || value === null) return false
  return keyOf(value, 'action') === 'openSheet' && typeof keyOf(value, 'component') === 'string'
}

/**
 * The drawer ids a drawer's `related[].onRowClick` opens (the pages overlays requirement
 * CAP-8). Collected apart from the grid references: a drawer reached ONLY this
 * way is secondary on its page, and must not self-open on the page's
 * `?record=` deep link (see {@link tagDrawerIfDispatched}).
 */
function collectRelatedRowTargets(component: ComponentEntry): readonly string[] {
  if (typeof component === 'string') return []
  const { type, related, children } = componentFields(component)
  const own =
    type === 'sheet' && Array.isArray(related)
      ? related.flatMap((entry: unknown) => {
          const onRowClick = keyOf(entry, 'onRowClick')
          return isOpenDrawerAction(onRowClick) ? [onRowClick.component] : []
        })
      : []
  if (!Array.isArray(children)) return own
  return [...own, ...children.flatMap(collectRelatedRowTargets)]
}

/**
 * The drawer a board's or a gallery's cards open, when `card.onClick` (or
 * `galleryCard.onClick`) is an `openSheet` — the same verb a grid row click
 * takes, so its drawer starts closed the same way.
 */
function cardClickTarget(card: unknown): readonly string[] {
  const onClick = keyOf(card, 'onClick')
  return isOpenDrawerAction(onClick) ? [onClick.component] : []
}

/**
 * The drawers a board's drop hooks open (`drag.onDrop[].action: openSheet`):
 * opened on the moved card once its move is saved, so they start closed like
 * the drawer a card click opens.
 */
function dropHookTargets(drag: unknown): readonly string[] {
  const onDrop = keyOf(drag, 'onDrop')
  if (!Array.isArray(onDrop)) return []
  return onDrop.flatMap((hook: unknown) => {
    const action = keyOf(hook, 'action')
    return isOpenDrawerAction(action) ? [action.component] : []
  })
}

/** Recursively collect every drawer-id referenced by `onRowClick: { action: 'openSheet', component }` (or a board's `card.onClick`, a gallery's `galleryCard.onClick`) in the subtree rooted at `component`. */
function collectIdsFromComponent(component: ComponentEntry): readonly string[] {
  if (typeof component === 'string') return []
  const { onRowClick, onSelect, onPinClick, card, galleryCard, drag, children } =
    componentFields(component)
  // A tree's selection and a map's pin open a drawer with the same verb.
  const selfId = [
    ...[onRowClick, onSelect, onPinClick].flatMap((click) =>
      isOpenDrawerAction(click) ? [click.component] : []
    ),
    ...cardClickTarget(card),
    ...cardClickTarget(galleryCard),
    ...dropHookTargets(drag),
  ]
  if (!Array.isArray(children)) return selfId
  return [...selfId, ...children.flatMap(collectIdsFromComponent)]
}

/** Collect every drawer-id referenced by an `onRowClick: { action: 'openSheet', component }` somewhere in the tree. */
function collectDispatchedDrawerIds(components: readonly ComponentEntry[]): ReadonlySet<string> {
  return new Set(components.flatMap(collectIdsFromComponent))
}

/** The two kinds of dispatch a drawer can be the target of. */
interface DispatchTargets {
  /** Ids a grid's `onRowClick: openSheet` names. */
  readonly grid: ReadonlySet<string>
  /** Ids a drawer's `related[].onRowClick: openSheet` names. */
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
  const { type, id } = componentFields(component)
  if (type !== 'sheet' || typeof id !== 'string') return component
  const fromGrid = targets.grid.has(id)
  const fromRelatedRow = targets.relatedRow.has(id)
  if (!fromGrid && !fromRelatedRow) return component
  return rewriteComponent(component, {
    props: {
      ...(component.props ?? {}),
      _openDrawerDispatchedById: id,
      ...(fromGrid ? {} : { _relatedRowTargetOnly: true }),
    },
  })
}

/** Recursively map components, tagging dispatched drawers and recursing into children. */
function mapTree(
  components: readonly ComponentEntry[],
  targets: DispatchTargets
): readonly ComponentEntry[] {
  return components.map((entry) =>
    typeof entry === 'string' ? entry : mapNode(entryAsComponent(entry), targets)
  )
}

/** One component, tagged when it is a dispatched drawer, with its children mapped. */
function mapNode(component: Component, targets: DispatchTargets): Component {
  const tagged = tagDrawerIfDispatched(component, targets)
  const { children } = componentFields(tagged)
  if (!Array.isArray(children)) return tagged
  return rewriteComponent(tagged, { children: mapTree(children, targets) })
}

/**
 * Entry point — collect dispatched drawer ids in a single pre-pass, then walk
 * the tree once tagging any matching drawer. Takes a page's own entries, which
 * may be unexpanded references; each is walked as a component, as every pass
 * walks one.
 */
export function resolveOpenDrawerDispatches(
  components: readonly ComponentNode[]
): readonly Component[] {
  const nodes = components.map(entryAsComponent)
  const grid = collectDispatchedDrawerIds(nodes)
  const relatedRow = new Set(nodes.flatMap(collectRelatedRowTargets))
  if (grid.size === 0 && relatedRow.size === 0) return nodes
  return nodes.map((component) => mapNode(component, { grid, relatedRow }))
}
