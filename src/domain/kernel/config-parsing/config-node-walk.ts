/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord, type Raw } from './plain-object'

/**
 * THE one walk of a config subtree as written: a page's `components` and
 * `layout`, a component template, a whole config. Every page and form rule that
 * looks for something "anywhere under here" reads its nodes from this module.
 *
 * WHY ONE WALK. Each rule carried a private copy, and a walk that skips a
 * shape is a rule that stops firing in silence — the defect class of a walker
 * stopping at a template reference. One walk, tested on every node kind the
 * config can hold, is one place for that to be wrong and one test to say so.
 *
 * STRUCTURAL, AND THEREFORE CLOSED. The walk is not typed against the component
 * union: that union is some ninety branches wide, each with its own children
 * key (`children`, a card's slots, a drawer's `related`, a split pane's panes, a
 * template reference's `vars`). A typed walk would need a line per branch and
 * would fail OPEN — a branch nobody listed is a subtree nobody visits. This
 * walk descends EVERY array element and EVERY object value, so there is no
 * unknown shape for it to skip: a node it has never heard of is visited like
 * any other. It only reads, so an unrelated object passing through is inert.
 *
 * Order is depth-first PRE-order, keys in insertion order — a node before
 * anything under it — which is the order every adopter reported in before.
 *
 * Pure: no I/O.
 */

/** One object node and where it sits: `pages[0].components[1]`, `config` at the root. */
export interface LocatedNode {
  readonly node: Raw
  /** The path from where the walk started; `''` for the starting node itself. */
  readonly path: string
}

/** The path of `key` under `path`, as every adopter spells it. */
const childPath = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`)

/** Every object node reachable from `value`, depth-first pre-order. */
export const objectNodes = (value: unknown): readonly Raw[] => {
  if (Array.isArray(value)) return value.flatMap(objectNodes)
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap(objectNodes)]
}

/**
 * `value` with every object node reachable from it replaced by `rewrite` of
 * that node, its own values rewritten first (depth-first POST-order). The
 * rewriting twin of {@link objectNodes}, for a pass that stamps the nodes it
 * finds rather than only reading them: arrays are mapped, and a primitive comes
 * back as it is. `rewrite` answering its argument unchanged keeps the node.
 */
export const mapObjectNodes = (value: unknown, rewrite: (node: Raw) => unknown): unknown => {
  if (Array.isArray(value)) return value.map((item) => mapObjectNodes(item, rewrite))
  if (!isRecord(value)) return value
  const entries = Object.entries(value).map(([key, child]) => [key, mapObjectNodes(child, rewrite)])
  return rewrite(Object.fromEntries(entries) as Raw)
}

/**
 * Every STRING leaf reachable from `value`, depth-first. A reference is legal
 * wherever a string is, so a rule keyed on known property names would stop
 * firing the moment a new one accepted one.
 */
export const stringLeaves = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringLeaves)
  if (!isRecord(value)) return []
  return Object.values(value).flatMap(stringLeaves)
}

/**
 * Every object node reachable from `value` with its path, depth-first pre-order.
 * `path` names `value` itself: `''` for a whole config, `'pages'` for its pages.
 */
export const locatedObjectNodes = (value: unknown, path: string): readonly LocatedNode[] => {
  if (Array.isArray(value))
    return value.flatMap((item, index) => locatedObjectNodes(item, `${path}[${index}]`))
  if (!isRecord(value)) return []
  return [
    { node: value, path },
    ...Object.entries(value).flatMap(([key, child]) =>
      locatedObjectNodes(child, childPath(path, key))
    ),
  ]
}
