/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a drawing no export stamped is read against its page: by position, and
 * only while it keeps the page's shape.
 *
 * Pure: no I/O, the same inputs always give the same answer.
 */

import { placedDrawnNodes } from './page-drawing'
import type { DrawnPage, PlacedDrawnNode } from './page-drawing'
import type { CurrentNode } from './page-merge-edits-service'

/** The path id a drawn position stands at on a page drawn as the config writes it. */
const positionalIdOf = (pageName: string, at: string): string =>
  `${pageName}:/components/${at.split('.').join('/children/')}`

/**
 * A drawing no export stamped — a board the designer drew for a page the
 * config did not declare yet, which `--new-pages` created from it — matched
 * by position: each drawn node to the page node at its place, when the type is
 * the same and its parent matched too. Written back again, the board is a
 * drawing of the page it created, not a second set of additions.
 *
 * Only a drawing of the page's whole shape is matched so: every page node
 * drawn at its place with its type, and nothing more. A board edited since (a
 * node inserted, removed or reordered) carries no id to tell which node is
 * which — a text inserted before another would take that one's place and
 * overwrite it — so it matches nothing, and its nodes are additions, as on a
 * board no page was created from: never a write onto the wrong node.
 */
export const matchByPosition = (
  drawn: readonly PlacedDrawnNode[],
  current: readonly CurrentNode[],
  pageName: string
): ReadonlyMap<string, CurrentNode> => {
  const byId = new Map(current.map((node) => [node.id, node] as const))
  const matches = drawn.reduce<ReadonlyMap<string, CurrentNode>>((acc, { at, node }) => {
    const parent = at.includes('.') ? at.slice(0, at.lastIndexOf('.')) : undefined
    if (parent !== undefined && !acc.has(parent)) return acc
    const candidate = byId.get(positionalIdOf(pageName, at))
    return candidate === undefined || candidate.type !== node.type
      ? acc
      : new Map([...acc, [at, candidate]])
  }, new Map())
  return matches.size === drawn.length && drawn.length === current.length ? matches : new Map()
}

/** Whether a drawing carries no export stamp at all: no stamp, and no node tagged with an id. */
export const unstamped = (page: DrawnPage, drawn: readonly PlacedDrawnNode[]): boolean =>
  page.stamp.length === 0 && drawn.every(({ node }) => node.id === undefined)

/**
 * Whether a drawing of a declared page carries no export stamp and was
 * reshaped: its nodes differ from the page's in number, or in the order of
 * their component types under a parent. Such a board cannot be matched by
 * position, and its nodes would all read as additions, so the import refuses
 * it whole rather than write each node twice.
 */
export const reshapedUnstamped = (
  drawn: DrawnPage,
  current: readonly CurrentNode[],
  pageName: string
): boolean => {
  const placed = placedDrawnNodes(drawn.nodes)
  if (!unstamped(drawn, placed)) return false
  const matched = matchByPosition(placed, current, pageName)
  return matched.size !== placed.length || placed.length !== current.length
}
