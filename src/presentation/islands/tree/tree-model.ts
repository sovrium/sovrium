/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The tree's shape, apart from its drawing: records nested under the record
 * their parent field names, siblings ordered, and the list of nodes a reader
 * can currently see — which is what both the drawing and the arrow keys walk.
 *
 * A record whose parent is not among the rows read (none, or one a view
 * filtered out) is a root, so a view never strands a branch out of sight.
 */

import type { TableRecord } from '../runtime/types'

export interface TreeNode {
  readonly id: string
  readonly label: string
  readonly count?: string
  readonly icon?: string
  readonly level: number
  readonly parentId?: string
  readonly childIds: readonly string[]
  readonly record: TableRecord
}

export interface TreeConfig {
  readonly parentField: string
  readonly labelField: string
  readonly countField?: string
  readonly iconField?: string
  readonly sortBy?: { readonly field: string; readonly direction?: 'asc' | 'desc' }
}

export interface Forest {
  readonly nodes: ReadonlyMap<string, TreeNode>
  readonly rootIds: readonly string[]
}

/** The id a relationship value names: a bare id, `{ id }`, or a one-entry list of either. */
export function linkedId(value: unknown): string | undefined {
  const one = Array.isArray(value) ? value[0] : value
  if (one === null || one === undefined || one === '') return undefined
  if (typeof one === 'object') return linkedId((one as { readonly id?: unknown }).id)
  return String(one)
}

const text = (value: unknown): string | undefined =>
  value === null || value === undefined || value === '' ? undefined : String(value)

/** Compare two siblings by the sort field, numbers as numbers. */
function compareBy(config: TreeConfig): (a: TreeNode, b: TreeNode) => number {
  const field = config.sortBy?.field
  const sign = config.sortBy?.direction === 'desc' ? -1 : 1
  return (a, b) => {
    const left = field === undefined ? a.label : a.record[field]
    const right = field === undefined ? b.label : b.record[field]
    const order =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left ?? '').localeCompare(String(right ?? ''))
    return order * sign
  }
}

/** Nest the rows by their parent field and order every set of siblings. */
export function buildForest(rows: readonly TableRecord[], config: TreeConfig): Forest {
  const ids = new Set(rows.map((row) => String(row.id)))
  const parentOf = (row: TableRecord): string | undefined => {
    const parent = linkedId(row[config.parentField])
    return parent !== undefined && ids.has(parent) && parent !== String(row.id) ? parent : undefined
  }
  const flat = rows.map((row) => ({ row, id: String(row.id), parentId: parentOf(row) }))
  const compare = compareBy(config)
  const build = (parentId: string | undefined, level: number): readonly TreeNode[] =>
    flat
      .filter((entry) => entry.parentId === parentId)
      .map((entry) => {
        const children = build(entry.id, level + 1)
        return {
          id: entry.id,
          label: text(entry.row[config.labelField]) ?? `#${entry.id}`,
          ...(config.countField !== undefined && { count: text(entry.row[config.countField]) }),
          ...(config.iconField !== undefined && { icon: text(entry.row[config.iconField]) }),
          level,
          ...(parentId !== undefined && { parentId }),
          childIds: children.toSorted(compare).map((child) => child.id),
          record: entry.row,
          children,
        }
      })
  const all = (list: readonly (TreeNode & { readonly children: readonly TreeNode[] })[]) =>
    list.flatMap((node): readonly TreeNode[] => [
      node,
      ...all(node.children as readonly (TreeNode & { readonly children: readonly TreeNode[] })[]),
    ])
  const roots = build(undefined, 1) as readonly (TreeNode & {
    readonly children: readonly TreeNode[]
  })[]
  return {
    nodes: new Map(all(roots).map((node) => [node.id, node])),
    rootIds: roots.toSorted(compare).map((node) => node.id),
  }
}

/** The ids open at first draw: every node above `depth`. */
export const initiallyOpen = (forest: Forest, depth: number): ReadonlySet<string> =>
  new Set([...forest.nodes.values()].filter((node) => node.level <= depth).map((node) => node.id))

/** The nodes a filter keeps: every match and every ancestor of one. */
export function keptByFilter(forest: Forest, query: string): ReadonlySet<string> | undefined {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return undefined
  const kept = new Set<string>()
  const keepWithAncestors = (id: string | undefined): void => {
    if (id === undefined || kept.has(id)) return
    kept.add(id)
    keepWithAncestors(forest.nodes.get(id)?.parentId)
  }
  forest.nodes.forEach((node) => {
    if (node.label.toLocaleLowerCase().includes(needle)) keepWithAncestors(node.id)
  })
  return kept
}

/** The nodes in reading order that are on screen: open branches, filtered by `kept`. */
export function visibleIds(
  forest: Forest,
  open: ReadonlySet<string>,
  kept: ReadonlySet<string> | undefined
): readonly string[] {
  const walk = (ids: readonly string[]): readonly string[] =>
    ids
      .filter((id) => kept === undefined || kept.has(id))
      .flatMap((id) => {
        const node = forest.nodes.get(id)
        const showChildren = node !== undefined && (kept !== undefined || open.has(id))
        return [id, ...(showChildren ? walk(node.childIds) : [])]
      })
  return walk(forest.rootIds)
}
