/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The identity of every node of a page, computed from the page entry alone.
 *
 * A node has two identities. Its PATH id is computed, never authored: the page
 * name, a colon, and the JSON Pointer (RFC 6901) of the node inside the page
 * entry — `dashboard:/components/1/children/0`. Its `key` is the author's,
 * optional, and survives a move a path cannot. A tool that reads a drawing back
 * matches a node by its key first, and by its path only when the type agrees.
 *
 * ─── WHAT IS WALKED ────────────────────────────────────────────────────────
 *
 * Every place a page entry holds nodes: a node's own `children`, the slots its
 * type declares beside them (a card's `footer`, an item's `media`), and each
 * breakpoint's `responsive.<bp>.children`. A string child is a node too — it
 * has a position, and an edit to its text is an edit to that position — so it
 * is listed with the `text` kind. A template placement is a node; the template
 * body it expands to is not the page's and is never walked, while the page
 * components the placement passes into its slots are: its `children` (the
 * default slot, `…/children/<i>`), then each named slot (`…/slots/<name>/<i>`).
 *
 * Pure: the same page entry yields the same ids in the same order, depth first
 * in the order the entry writes them.
 */

import { componentSlotsOf } from './components/component-types/component-type-union'

/** One node of a page entry, as the walker found it. */
export interface PageNodeIdentity {
  /** The path id: `<page name>:<JSON Pointer>`. */
  readonly id: string
  /** The JSON Pointer of the node inside the page entry. */
  readonly pointer: string
  /** The author's key, when the node carries one. */
  readonly key?: string | undefined
  /** A component (or a template placement), or a string child. */
  readonly kind: 'component' | 'text'
  /** The node itself, exactly as the entry holds it. */
  readonly node: unknown
}

/** The slice of a page entry the walker reads. */
export interface IdentifiablePage {
  readonly name: string
  readonly components?: readonly unknown[] | undefined
}

/** One node and the pointer it sits at. */
interface Located {
  readonly pointer: string
  readonly node: unknown
}

/** One JSON Pointer reference token, escaped (`~` → `~0`, `/` → `~1`). */
export const escapePointerSegment = (segment: string): string =>
  segment.replaceAll('~', '~0').replaceAll('/', '~1')

/** A pointer extended by its segments. */
export const pointerTo = (pointer: string, ...segments: readonly (string | number)[]): string =>
  segments.reduce<string>(
    (acc, segment) => `${acc}/${escapePointerSegment(String(segment))}`,
    pointer
  )

/** The path id of the node at `pointer` on the page `pageName`. */
export const pageNodeIdOf = (pageName: string, pointer: string): string => `${pageName}:${pointer}`

/** Whether a node places a template (`{ component: 'name' }` or `{ $ref: 'name' }`). */
export const isTemplatePlacement = (node: unknown): boolean => {
  if (typeof node !== 'object' || node === null) return false
  const record = node as Readonly<Record<string, unknown>>
  return typeof record['component'] === 'string' || typeof record['$ref'] === 'string'
}

/** The entries of one list, each at its index under `pointer`. */
const listAt = (pointer: string, list: unknown): readonly Located[] =>
  Array.isArray(list)
    ? (list as readonly unknown[]).map((node, index) => ({
        pointer: pointerTo(pointer, index),
        node,
      }))
    : []

/** The nodes a type's slots hold: a listed slot entry by entry, a single slot as itself. */
const slotEntriesOf = (
  node: Readonly<Record<string, unknown>>,
  pointer: string
): readonly Located[] =>
  componentSlotsOf(typeof node['type'] === 'string' ? node['type'] : '').flatMap((slot) => {
    const value = node[slot]
    if (Array.isArray(value)) return listAt(pointerTo(pointer, slot), value)
    return typeof value === 'object' && value !== null
      ? [{ pointer: pointerTo(pointer, slot), node: value }]
      : []
  })

/** The nodes each breakpoint draws in place of the children. */
const responsiveEntriesOf = (
  node: Readonly<Record<string, unknown>>,
  pointer: string
): readonly Located[] => {
  const { responsive } = node
  if (typeof responsive !== 'object' || responsive === null) return []
  return Object.entries(responsive as Readonly<Record<string, unknown>>).flatMap(
    ([breakpoint, variant]) =>
      listAt(
        pointerTo(pointer, 'responsive', breakpoint, 'children'),
        (variant as { readonly children?: unknown } | null)?.children
      )
  )
}

/** The page components a placement passes to each named slot, slot by slot. */
const placementSlotEntriesOf = (
  node: Readonly<Record<string, unknown>>,
  pointer: string
): readonly Located[] => {
  const { slots } = node
  if (typeof slots !== 'object' || slots === null || Array.isArray(slots)) return []
  return Object.entries(slots as Readonly<Record<string, unknown>>).flatMap(([name, list]) =>
    listAt(pointerTo(pointer, 'slots', name), list)
  )
}

/** Every node directly beneath one node, in the order the entry writes them. */
const childEntriesOf = (
  node: Readonly<Record<string, unknown>>,
  pointer: string
): readonly Located[] => {
  const own = listAt(pointerTo(pointer, 'children'), node['children'])
  // A placement's slotted children are the page's; its template's slots are not.
  if (isTemplatePlacement(node)) return [...own, ...placementSlotEntriesOf(node, pointer)]
  return [...own, ...slotEntriesOf(node, pointer), ...responsiveEntriesOf(node, pointer)]
}

/** A node, then every node beneath it. */
const walkNode = (pageName: string, { pointer, node }: Located): readonly PageNodeIdentity[] => {
  const id = pageNodeIdOf(pageName, pointer)
  if (typeof node === 'string') return [{ id, pointer, kind: 'text', node }]
  if (typeof node !== 'object' || node === null) return []
  const record = node as Readonly<Record<string, unknown>>
  const key = typeof record['key'] === 'string' ? record['key'] : undefined
  const self: PageNodeIdentity = {
    id,
    pointer,
    ...(key === undefined ? {} : { key }),
    kind: 'component',
    node,
  }
  return [self, ...childEntriesOf(record, pointer).flatMap((entry) => walkNode(pageName, entry))]
}

/**
 * Every node of a page entry with its path id and its key, depth first.
 *
 * @param page - the page entry, decoded or as authored.
 * @returns one entry per node, in the order the entry writes them.
 */
export const nodeIdsOf = (page: IdentifiablePage): readonly PageNodeIdentity[] =>
  listAt('/components', page.components).flatMap((entry) => walkNode(page.name, entry))

/**
 * Where a page EXPORT writes a node's path id on the node it draws, for the
 * renderer to stamp as `data-sovrium-id`.
 *
 * Only the export sets it, on its own copy of a page: an authored config cannot
 * carry it, since the decoder refuses a key no component declares, so a page a
 * visitor loads never carries the attribute. Underscored, like every render-time
 * marker, so no prop-to-attribute pass ever copies it into the DOM by itself.
 */
export const EXPORT_NODE_ID_KEY = '_exportNodeId'

/** The path id an export wrote on a node, or `undefined` on any other node. */
export const exportNodeIdOf = (node: unknown): string | undefined => {
  if (typeof node !== 'object' || node === null) return undefined
  const id = (node as Readonly<Record<string, unknown>>)[EXPORT_NODE_ID_KEY]
  return typeof id === 'string' ? id : undefined
}
