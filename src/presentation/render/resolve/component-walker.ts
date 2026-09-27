/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared structural traversal of a page-component tree.
 *
 * A page's `components` is a heterogeneous tree: arrays of nodes, each node
 * optionally carrying nested `children` (an array of child nodes) and/or a
 * single wrapped `component`. This module owns the one definition of "how to
 * walk that tree" so consumers don't each re-derive the array / `children` /
 * `component` branch structure.
 *
 * SCOPE NOTE — this is a *visit/collect* traversal only. It does NOT cover the
 * pruning walk in `visibility-filter.ts`, which REMOVES gated nodes (and keeps
 * a `tabs` strip aligned with its bodies) rather than visiting them. Render-time
 * visibility and submission-time form-access remain separate concerns and must
 * not be collapsed into one walk.
 */

/**
 * Recursively collect values from a component tree.
 *
 * For each node the walker:
 *   1. recurses into every element when the node is an array,
 *   2. otherwise calls `visit(node)` and, for an object node, recurses into its
 *      `children` array, its wrapped `component`, and every
 *      `responsive.<breakpoint>.children` override.
 *
 * `shouldSkip` short-circuits a subtree entirely (neither the node nor its
 * descendants are visited) — e.g. a subtree hidden from the current session.
 * `visit` returns the values contributed by a single node (an empty array when
 * the node contributes nothing); all contributions are flattened.
 */
export function collectFromComponentTree<T>(
  node: unknown,
  options: {
    readonly visit: (node: unknown) => readonly T[]
    readonly shouldSkip?: (node: unknown) => boolean
  }
): readonly T[] {
  const { visit, shouldSkip } = options
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectFromComponentTree(child, options))
  }
  if (shouldSkip?.(node)) return []
  const selfValues = visit(node)
  if (typeof node !== 'object' || node === null) return selfValues
  const {
    children,
    component: wrapped,
    responsive,
  } = node as {
    readonly children?: ReadonlyArray<unknown>
    readonly component?: unknown
    readonly responsive?: unknown
  }
  const childValues = children === undefined ? [] : collectFromComponentTree(children, options)
  const wrappedValues = wrapped === undefined ? [] : collectFromComponentTree(wrapped, options)
  return [
    ...selfValues,
    ...childValues,
    ...wrappedValues,
    ...responsiveChildValues(responsive, options),
  ]
}

/**
 * Values contributed by every `responsive.<breakpoint>.children` override — a
 * breakpoint can swap a node's children wholesale, so those children are part
 * of the tree too.
 */
function responsiveChildValues<T>(
  responsive: unknown,
  options: {
    readonly visit: (node: unknown) => readonly T[]
    readonly shouldSkip?: (node: unknown) => boolean
  }
): readonly T[] {
  if (typeof responsive !== 'object' || responsive === null) return []
  return Object.values(responsive as Record<string, unknown>).flatMap((override) => {
    if (typeof override !== 'object' || override === null) return []
    const { children } = override as { readonly children?: unknown }
    return Array.isArray(children) ? collectFromComponentTree(children, options) : []
  })
}
