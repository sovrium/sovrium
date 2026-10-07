/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fills a component template's `$children` slot with a placement's own
 * components.
 *
 * A template marks one node with `children: $children`; the reference that
 * places it passes the page's components as `children`. The template's vars
 * are substituted BEFORE this runs, so they never reach the slotted
 * components: those belong to the page and are read in its scope. A placement
 * without `children` draws the slot empty — the marker itself must never
 * reach the renderer, where it would be a string where a list belongs.
 *
 * Only a node's own `children` is walked: the schema refuses the marker in a
 * responsive breakpoint's children, and the boot refusals guarantee at most
 * one slot per template.
 */

/** The value a template node writes in place of its `children` list. */
export const TEMPLATE_SLOT_MARKER = '$children'

/**
 * The placement's `children`, as the list that fills the slot — empty when
 * the placement passed none.
 *
 * @param placement - A component reference node
 * @returns Its `children` when it is a list, otherwise an empty list
 */
export const placementChildrenOf = (placement: unknown): readonly unknown[] => {
  if (typeof placement !== 'object' || placement === null) return []
  const { children } = placement as { readonly children?: unknown }
  return Array.isArray(children) ? children : []
}

/**
 * Replace the `$children` marker anywhere under `node` with `slotted`.
 * Identity-preserving: a tree with no marker comes back by reference.
 *
 * @param node - An expanded template root (or any subtree of one)
 * @param slotted - The components that fill the slot
 * @returns The tree with its slot filled
 */
export const fillTemplateSlot = <T>(node: T, slotted: readonly unknown[]): T => {
  if (typeof node !== 'object' || node === null) return node
  const { children } = node as { readonly children?: unknown }
  if (children === TEMPLATE_SLOT_MARKER) return { ...node, children: slotted } as T
  if (!Array.isArray(children) || children.length === 0) return node
  const filled = children.map((child: unknown) => fillTemplateSlot(child, slotted))
  return filled.some((child, index) => child !== children[index])
    ? ({ ...node, children: filled } as T)
    : node
}
