/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every board of a page read back as that one page: a canvas exported with
 * `--seed` or `--state` draws a page on its default board and on boards drawn
 * at other states (a record, a query branch, a role, dark, a phone width),
 * each root naming its state in `data-sovrium-state`.
 *
 * The page is read from its default board, and an edit made on any of its
 * other boards is an edit of the page: a node a state board draws differently
 * from the default board (its text, its variant, its size, its layout) takes
 * the state board's value. A node a state board does not draw is no deletion,
 * and a state board that draws the app's answer in place of the page (its
 * not-found page) has none of the page's nodes to read. Two default boards of
 * one page are both refused, since nothing says which one is the design.
 */

import type { PageDrawingFinding, ParsedPageDrawing } from './page-drawing'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/** One board read back, with the state its root names (`undefined` on a default board). */
export interface StateBoardDrawing {
  readonly drawing: ParsedPageDrawing
  readonly state: string | undefined
}

/** The fields of a node a board draws, its children apart. */
const ownOf = ({ children: _children, ...own }: PageDesignTreeNode): string => JSON.stringify(own)

/** Every node of some trees, by id, the first board's first. */
const nodesById = (nodes: readonly PageDesignTreeNode[]): ReadonlyMap<string, PageDesignTreeNode> =>
  new Map(
    nodes.flatMap((node) => [...nodesById(node.children), [node.id, node] as const]).toReversed()
  )

/** A node of the default board, taking the first state board's own edit of it. */
const editedNode = (
  node: PageDesignTreeNode,
  others: readonly ReadonlyMap<string, PageDesignTreeNode>[]
): PageDesignTreeNode => {
  const edit = others
    .map((nodes) => nodes.get(node.id))
    .find((other) => other !== undefined && ownOf(other) !== ownOf(node))
  const children = node.children.map((child) => editedNode(child, others))
  return edit === undefined ? { ...node, children } : { ...edit, children }
}

/** A page's default board, with every edit its state boards hold. */
const mergedPage = (
  main: ParsedPageDrawing,
  states: readonly ParsedPageDrawing[]
): ParsedPageDrawing => {
  if (states.length === 0) return main
  const others = states.map((state) => nodesById(state.tree.nodes))
  return {
    ...main,
    tree: { ...main.tree, nodes: main.tree.nodes.map((node) => editedNode(node, others)) },
  }
}

/**
 * Every page a canvas draws, each read once from all its boards.
 *
 * @param boards - every board read back, in canvas order.
 */
export const mergedStateBoards = (
  boards: readonly StateBoardDrawing[]
): {
  readonly pages: readonly ParsedPageDrawing[]
  readonly refused: readonly PageDrawingFinding[]
} => {
  const pages = [...new Set(boards.map((board) => board.drawing.tree.page))]
  return pages.reduce<{
    readonly pages: readonly ParsedPageDrawing[]
    readonly refused: readonly PageDrawingFinding[]
  }>(
    (read, page) => {
      const own = boards.filter((board) => board.drawing.tree.page === page)
      const defaults = own.filter((board) => board.state === undefined)
      const states = own.filter((board) => board.state !== undefined).map((board) => board.drawing)
      if (defaults.length > 1) {
        return {
          ...read,
          refused: [
            ...read.refused,
            ...defaults.map((board) => ({
              board: board.drawing.board,
              detail: `the page ${page} is drawn on more than one board; keep one`,
            })),
          ],
        }
      }
      const [main = states[0]] = defaults.map((board) => board.drawing)
      if (main === undefined) return read
      const rest = states.filter((state) => state !== main)
      return { ...read, pages: [...read.pages, mergedPage(main, rest)] }
    },
    { pages: [], refused: [] }
  )
}
