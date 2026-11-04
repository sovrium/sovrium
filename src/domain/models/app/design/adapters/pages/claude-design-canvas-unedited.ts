/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Chunk } from 'effect'
import { shownText } from './claude-design-canvas-style'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/**
 * What a Claude Design board draws that is no edit, whatever it reads like:
 * the parse half reads it as the page node it draws, never as a change.
 */

/**
 * A board's nodes, each node drawn again under an id already read dropped. A
 * container that repeats over a list draws its children once per entry, every
 * copy stamped with the same id: they are all drawings of ONE page node, so
 * the first copy is read as that node and the others are not read again.
 */
export const withoutRepeatedCopies = (
  nodes: readonly PageDesignTreeNode[]
): readonly PageDesignTreeNode[] => {
  const ids = idsInOrder(nodes)
  if (new Set(ids).size === ids.length) return nodes
  // The position, in document order, of the first node drawn under each id.
  const first = new Map(ids.map((id, at) => [id, at] as const).toReversed())
  return Chunk.toReadonlyArray(firstCopiesOf(nodes, first, 0).nodes)
}

/** Every node id of a tree, in document order. */
const idsInOrder = (nodes: readonly PageDesignTreeNode[]): readonly string[] =>
  nodes.flatMap((node) => [node.id, ...idsInOrder(node.children)])

/** The nodes drawn first under their id, `at` being the first node's position in document order. */
const firstCopiesOf = (
  nodes: readonly PageDesignTreeNode[],
  first: ReadonlyMap<string, number>,
  at: number
): { readonly nodes: Chunk.Chunk<PageDesignTreeNode>; readonly at: number } =>
  nodes.reduce<{ readonly nodes: Chunk.Chunk<PageDesignTreeNode>; readonly at: number }>(
    (walk, node) => {
      const inner = firstCopiesOf(node.children, first, walk.at + 1)
      return {
        nodes:
          first.get(node.id) === walk.at
            ? Chunk.append(walk.nodes, { ...node, children: Chunk.toReadonlyArray(inner.nodes) })
            : walk.nodes,
        at: inner.at,
      }
    },
    { nodes: Chunk.empty(), at }
  )

/** The binding whose drawn text depends on the engine that drew it, never on the config. */
const ENGINE_VERSION = '$app.engineVersion'

/** What an engine version looks like where a board prints one: `0.46.1`, `1.0.0-rc.2`. */
const VERSION_PATTERN = '[0-9][0-9A-Za-z.+-]*'

/**
 * Whether a bound text is its binding drawn by SOME engine: the binding prints
 * the engine's version and the text is that binding with a version in its
 * place. A canvas an earlier engine drew then reads that line as drawn, not as
 * an edit; any other wording of it is still read, and refused as one.
 */
export const printsAnEngineVersion = (binding: string | undefined, text: string): boolean => {
  if (binding === undefined || !binding.includes(ENGINE_VERSION)) return false
  const pattern = shownText(binding)
    .split(ENGINE_VERSION)
    .map((part) => part.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(VERSION_PATTERN)
  return new RegExp(`^${pattern}$`).test(shownText(text))
}
