/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fills a component template's slots with a placement's own components.
 *
 * A template marks the default slot with `children: $children` and each named
 * slot with `children: $slots.<name>`; the reference that places it passes the
 * page's components as `children` and `slots.<name>`. The template's vars are
 * substituted BEFORE this runs, so they never reach the slotted components:
 * those belong to the page and are read in its scope. A slot the placement
 * leaves out draws empty — a marker must never reach the renderer, where it
 * would be a string where a list belongs.
 *
 * Only a node's own `children` is walked: the schema refuses a marker in a
 * responsive breakpoint's children, and the boot refusals guarantee each slot
 * is marked at most once per template.
 */

/** The value a template node writes in place of its `children` list for the default slot. */
export const TEMPLATE_SLOT_MARKER = '$children'

/** The prefix of a named slot's marker, `$slots.<name>`. */
export const NAMED_SLOT_MARKER_PREFIX = '$slots.'

/** The name a `$slots.<name>` marker names, or `undefined` for any other value. */
export const namedSlotOf = (children: unknown): string | undefined =>
  typeof children === 'string' && children.startsWith(NAMED_SLOT_MARKER_PREFIX)
    ? children.slice(NAMED_SLOT_MARKER_PREFIX.length)
    : undefined

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
 * The placement's `slots`, each named slot's list of components — empty when
 * the placement passed none.
 *
 * @param placement - A component reference node
 * @returns Each slot name with the list passed for it
 */
export const placementSlotsOf = (
  placement: unknown
): Readonly<Record<string, readonly unknown[]>> => {
  if (typeof placement !== 'object' || placement === null) return {}
  const { slots } = placement as { readonly slots?: unknown }
  if (typeof slots !== 'object' || slots === null || Array.isArray(slots)) return {}
  return Object.fromEntries(
    Object.entries(slots as Record<string, unknown>).flatMap(([name, items]) =>
      Array.isArray(items) ? [[name, items as readonly unknown[]] as const] : []
    )
  )
}

/** What fills a marker's position, or `undefined` when `children` is no marker. */
const fillOf = (
  children: unknown,
  slotted: readonly unknown[],
  named: Readonly<Record<string, readonly unknown[]>>
): readonly unknown[] | undefined => {
  if (children === TEMPLATE_SLOT_MARKER) return slotted
  const name = namedSlotOf(children)
  return name === undefined ? undefined : (named[name] ?? [])
}

/**
 * Replace the `$children` marker anywhere under `node` with `slotted`, and
 * each `$slots.<name>` marker with `named[name]` (empty when absent).
 * Identity-preserving: a tree with no marker comes back by reference.
 *
 * @param node - An expanded template root (or any subtree of one)
 * @param slotted - The components that fill the default slot
 * @param named - The components that fill each named slot
 * @returns The tree with its slots filled
 */
export const fillTemplateSlot = <T>(
  node: T,
  slotted: readonly unknown[],
  named: Readonly<Record<string, readonly unknown[]>> = {}
): T => {
  if (typeof node !== 'object' || node === null) return node
  const { children } = node as { readonly children?: unknown }
  const fill = fillOf(children, slotted, named)
  if (fill !== undefined) return { ...node, children: fill } as T
  if (!Array.isArray(children) || children.length === 0) return node
  const filled = children.map((child: unknown) => fillTemplateSlot(child, slotted, named))
  return filled.some((child, index) => child !== children[index])
    ? ({ ...node, children: filled } as T)
    : node
}
