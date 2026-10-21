/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What every page migration (Notion, Webflow, Retool classic) does to the
 * node tree it converted, once the source's own reading is done: give each
 * node its key, describe the page's structure for the report, and refuse a
 * page whose name or path the config already holds.
 *
 * Shared rather than written once per source, so the three reports count,
 * key and refuse alike. Each walk is linear in the tree: keyed siblings are
 * collected in a chunk, and types are counted in one pass.
 */

import { Chunk } from 'effect'
import type { MigratedPagesReport } from './migrated-pages-report'

/** The part of a migrated node these helpers read: its type, its key, its children. */
export interface MigratedTreeNode<N> {
  readonly type: string
  readonly key?: string
  readonly children?: readonly N[]
}

/** Each node keyed `<type>-<n>`, counting depth first from `counts`, and the counts after. */
const keyed = <N extends MigratedTreeNode<N>>(
  nodes: readonly N[],
  counts: ReadonlyMap<string, number>
): readonly [readonly N[], ReadonlyMap<string, number>] => {
  const [done, after] = nodes.reduce<readonly [Chunk.Chunk<N>, ReadonlyMap<string, number>]>(
    ([soFar, seen], node) => {
      const n = (seen.get(node.type) ?? 0) + 1
      // One entry per component type: copying this map costs the number of types, not nodes.
      const counted = new Map([...seen, [node.type, n]])
      const [children, next] =
        node.children === undefined ? [undefined, counted] : keyed(node.children, counted)
      const { type, ...rest } = node
      const withKey = {
        type,
        key: `${type}-${n}`,
        ...rest,
        ...(children === undefined ? {} : { children }),
      } as N
      return [Chunk.append(soFar, withKey), next]
    },
    [Chunk.empty(), counts]
  )
  return [Chunk.toReadonlyArray(done), after]
}

/**
 * Give every node of a page a fresh key, `<type>-<n>` in depth-first order:
 * the first button is `button-1`, the next `button-2`, wherever it sits.
 */
export const withMigratedKeys = <N extends MigratedTreeNode<N>>(
  nodes: readonly N[]
): readonly N[] => keyed(nodes, new Map())[0]

/** Every node of a tree, depth first. */
export const allMigratedNodes = <N extends MigratedTreeNode<N>>(
  nodes: readonly N[]
): readonly N[] => nodes.flatMap((node) => [node, ...allMigratedNodes(node.children ?? [])])

/** How many levels a tree nests: `0` for no node, `1` for nodes without children. */
const depthOf = <N extends MigratedTreeNode<N>>(nodes: readonly N[]): number =>
  nodes.reduce((deepest, node) => Math.max(deepest, 1 + depthOf(node.children ?? [])), 0)

/** One page's entry of the report's `structure`: its node count, depth and types. */
export const migratedPageStructure = <N extends MigratedTreeNode<N>>(
  page: string,
  components: readonly N[]
): MigratedPagesReport['structure'][number] => {
  const nodes = allMigratedNodes(components)
  const counts = nodes.reduce<ReadonlyMap<string, number>>(
    (types, node) => new Map([...types, [node.type, (types.get(node.type) ?? 0) + 1]]),
    new Map()
  )
  return {
    page,
    nodes: nodes.length,
    depth: depthOf(components),
    types: Object.fromEntries(counts),
  }
}

/** A page the config already holds, by name or path. */
interface ExistingPage {
  readonly name: string
  readonly path: string
}

/**
 * Why a migrated page is not written, when the config already holds a page of
 * its name or at its path: a migration writes new pages only.
 */
export const pageCollisionRefusal = (
  page: ExistingPage,
  existing: readonly ExistingPage[] = []
): MigratedPagesReport['refused'][number] | undefined => {
  if (existing.some((held) => held.name === page.name)) {
    return {
      page: page.name,
      reason: 'page-name-collision',
      detail: `The config already holds a page named "${page.name}"; a migration writes new pages only and leaves that one untouched.`,
    }
  }
  return existing.some((held) => held.path === page.path)
    ? {
        page: page.name,
        reason: 'page-path-collision',
        detail: `The config already holds a page at "${page.path}"; a migration writes new pages only and leaves that one untouched.`,
      }
    : undefined
}
