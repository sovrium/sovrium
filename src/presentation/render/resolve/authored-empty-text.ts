/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isPlainObject } from '@/domain/kernel/config-parsing/plain-object'

/**
 * Tells a `text` WRITTEN empty from one whose reference RESOLVED to nothing.
 *
 * Both reach the renderer as `content: ''`, and they mean opposite things. A
 * text written as `content: ''` (or a template text whose variable a placement
 * passes as `''`) is a slot the author put there on purpose, usually for a page
 * script to fill: it draws its element, empty, with every attribute it
 * declares. A text whose `$app.version`, `$record.<field>` or other page-level
 * reference resolved to nothing is dropped instead, unless something can still
 * fill it (`resolvedToNothing` in `registry/text-components.tsx`).
 *
 * The difference is only visible BEFORE the page-level references resolve, and
 * that is exactly the point where the page tree has had its template
 * placements inlined and nothing else (`component-reference-expansion.ts`). So
 * the empty texts are stamped there, under {@link AUTHORED_EMPTY_KEY}, and the
 * renderer reads the stamp. Underscored, like every render-time marker, so no
 * prop-to-attribute pass copies it into the DOM, and beside `props` rather than
 * in them, so it survives every pass that rebuilds a node's props.
 */

/** The render-time field a text written with empty content carries. */
export const AUTHORED_EMPTY_KEY = '_authoredEmpty'

/** Whether a node is a text written with empty content, after template expansion. */
const isEmptyText = (node: Readonly<Record<string, unknown>>): boolean =>
  node['type'] === 'text' && node['content'] === ''

/**
 * `value` with every text written with empty content stamped. Every array and
 * object is descended, so a text in a card slot or a breakpoint is reached as
 * one in `children` is. Identity-preserving: a subtree holding no such text
 * comes back by reference.
 */
export function stampAuthoredEmptyTexts<T>(value: T): T {
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value
    const stamped = items.map((item) => stampAuthoredEmptyTexts(item))
    return (stamped.some((item, index) => item !== items[index]) ? stamped : value) as T
  }
  if (!isPlainObject(value)) return value
  const node = value
  const entries = Object.entries(node)
  const stamped = entries.map(([key, child]) => [key, stampAuthoredEmptyTexts(child)] as const)
  const changed = stamped.some(([, child], index) => child !== entries[index]?.[1])
  // A spread, so a symbol stamp an earlier pass set on the node survives.
  const base = changed ? { ...node, ...Object.fromEntries(stamped) } : node
  return (isEmptyText(node) ? { ...base, [AUTHORED_EMPTY_KEY]: true } : base) as T
}

/** Whether a node carries the stamp. */
export const isAuthoredEmpty = (node: Readonly<Record<string, unknown>>): boolean =>
  node[AUTHORED_EMPTY_KEY] === true
