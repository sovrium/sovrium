/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Mark WHICH item of a set is the current one.
 *
 * ─── WHY THIS IS NOT A VISIBILITY PASS ─────────────────────────────────────
 *
 * Every other conditional in the render pipeline decides whether an element
 * EXISTS: `visibility.condition` and `visibility.capability` SSR-exclude it,
 * `when` / `roles` CSS-hide it, `visibility.record` omits it from a row. A
 * period rail needs none of those — all three of its presets are always
 * present, because they ARE the choice. What varies is one ATTRIBUTE on one of
 * them: `aria-current="page"`, plus the class that makes it look selected.
 *
 * ─── WHY IT RUNS LAST ──────────────────────────────────────────────────────
 *
 * `activeWhen.value` is normally a `$`-reference, and this pass compares
 * LITERALS. Running it after P7/P4/G1/P11/P8 is what lets it do so: by then
 * `$window.id`, `$query.<name>`, `$param.<name>` and `$app.<name>` have all
 * been substituted by passes that walk every string leaf, `activeWhen.value`
 * included. Moving this earlier would compare the reference itself and mark
 * nothing, forever, in silence.
 *
 * That ordering is also why no URL is needed here. The framework primitive —
 * mark a link current when its `href` matches the request — would need a match
 * MODE (exact / path-only / prefix), and every mode is wrong for some nav: a
 * period rail differs only in its query string, a sidebar must stay current
 * across a whole subtree. A value comparison needs none, and the same key
 * expresses "the selected period", "the open tab" and "the current section".
 *
 * ─── THE KEYS ARE SPENT HERE ───────────────────────────────────────────────
 *
 * Both are stripped whether or not the comparison held. They are a render-time
 * instruction, not content: leaving them on the node would serialise a spent
 * declaration into an island's props and invite a second consumer to re-derive
 * the answer from a `value` that is no longer a reference.
 */

import type { Page } from '@/domain/models/app/pages'

/** The two keys, as they appear on a node before this pass spends them. */
interface ActiveMarkerNode {
  readonly activeWhen?: { readonly value: string; readonly equals: string }
  readonly activeProps?: Readonly<Record<string, unknown>>
  readonly props?: Readonly<Record<string, unknown>>
}

/**
 * Apply — and remove — one node's own marker declaration.
 *
 * The decode rule refuses either key without the other, so a node carrying one
 * carries both; the guard below is a total-function courtesy rather than a
 * reachable branch.
 *
 * `activeProps` MERGES over `props` key by key, last wins, rather than
 * replacing it: an attribute then appears only on the current item, and a
 * `className` declared in both is SWAPPED rather than concatenated — which is
 * what a selected style usually wants and what a hand-written rail already
 * does.
 */
function applyMarker(node: object): object {
  const { activeWhen, activeProps, props } = node as ActiveMarkerNode
  if (activeWhen === undefined && activeProps === undefined) return node

  const {
    activeWhen: _spentWhen,
    activeProps: _spentProps,
    ...rest
  } = node as Record<string, unknown>
  if (activeWhen === undefined || activeProps === undefined) return rest
  if (activeWhen.value !== activeWhen.equals) return rest

  return { ...rest, props: { ...(props ?? {}), ...activeProps } }
}

/**
 * Recurse into a node's `children` and its wrapped `component`.
 *
 * Both branches are needed: a rail's links sit in a `container`'s `children`,
 * while a `specimen` wraps a single component under `component`. Returns the
 * SAME reference when nothing below changed, so a page with no marker anywhere
 * pays one walk and no copy.
 */
function mapNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    const mapped = node.map(mapNode)
    return mapped.every((child, i) => child === node[i]) ? node : mapped
  }
  if (typeof node !== 'object' || node === null) return node
  return mapBranches(applyMarker(node))
}

/**
 * Re-map a marked node's two nesting branches, preserving identity.
 *
 * Split out of {@link mapNode} so each stays under the complexity cap; the
 * `undefined` guards are what keep an absent branch from becoming a present
 * `undefined` key on the copy.
 */
function mapBranches(marked: object): object {
  const { children, component: wrapped } = marked as {
    readonly children?: unknown
    readonly component?: unknown
  }
  const mappedChildren = children === undefined ? children : mapNode(children)
  const mappedWrapped = wrapped === undefined ? wrapped : mapNode(wrapped)
  if (mappedChildren === children && mappedWrapped === wrapped) return marked

  return {
    ...(marked as Record<string, unknown>),
    ...(mappedChildren !== children ? { children: mappedChildren } : {}),
    ...(mappedWrapped !== wrapped ? { component: mappedWrapped } : {}),
  }
}

/**
 * Resolve every `activeWhen` / `activeProps` pair on a page.
 *
 * Walks the same two families as the substitution passes it follows
 * (`components`, `layout`), so a marker is legal wherever a component is.
 */
export function resolveActiveMarkers(page: Page): Page {
  const components = page.components === undefined ? undefined : mapNode(page.components)
  const layout = page.layout === undefined ? undefined : mapNode(page.layout)
  if (components === page.components && layout === page.layout) return page

  return {
    ...page,
    ...(components !== page.components ? { components: components as Page['components'] } : {}),
    ...(layout !== page.layout ? { layout: layout as Page['layout'] } : {}),
  }
}
