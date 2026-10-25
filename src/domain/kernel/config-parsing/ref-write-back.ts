/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Writing an edited config back through its `$ref` includes.
 *
 * A YAML or JSON config may be assembled from partials: `{ $ref: ./file }`
 * stands for the whole content of another file. An edit is computed on the
 * RESOLVED config, where every include is replaced by what it names; this
 * module carries it back to the files, so each value lands in the one file
 * that holds it and no include is ever replaced by its content.
 *
 * ─── OWNERSHIP ─────────────────────────────────────────────────────────────
 *
 * An include has no siblings, so every resolved position belongs to exactly
 * one file: the innermost include whose content holds it, else the config.
 * A position that does not exist yet belongs to the file of its nearest
 * existing parent ({@link ownerOf}).
 *
 * ─── THE REWRITE ───────────────────────────────────────────────────────────
 *
 * {@link rewriteGraph} walks each file's RAW tree beside the resolved tree as
 * it was and as it is to be. A value changes in place; a mapping keeps its
 * keys in their order, a new key going last; a list is aligned item by item
 * (equal items first, then by `key`/`name`/`id`, then in order), so an item
 * moved within its list keeps its raw form, an include included. Reaching an
 * include, the walk continues in the file it names and records a VISIT: what
 * that file becomes when seen from that place. A file two places include is
 * visited twice, and {@link settleVisits} keeps it only when every counted
 * visit agrees.
 */

import { isRecord } from './plain-object'
import { alignLists, canonicalJson, childOf, sameTree, type Pointer } from './ref-tree-compare'
import { isFileRefValue } from './ref-value-kind'

/** A config and the partials it includes, each as its raw tree, by absolute path. */
export interface RefGraph {
  readonly root: string
  readonly trees: ReadonlyMap<string, unknown>
  /** The absolute path a `$ref` written in the file `from` names. */
  readonly target: (from: string, ref: string) => string
}

/** The file a `{ $ref }` node includes, as written, or `undefined` for any other value. */
export const includeOf = (value: unknown): string | undefined => {
  if (!isRecord(value) || Object.keys(value).length !== 1) return undefined
  const ref = value['$ref']
  return typeof ref === 'string' && isFileRefValue(ref) ? ref : undefined
}

/** A position as a JSON Pointer: `/components/0/content`, `''` for the root. */
export const jsonPointerOf = (pointer: Pointer): string =>
  pointer.map((step) => `/${String(step).replaceAll('~', '~0').replaceAll('/', '~1')}`).join('')

/** The file a position belongs to, and where it sits inside that file. */
export interface Owner {
  readonly file: string
  readonly pointer: Pointer
}

/** Follow every include a node is, to the file whose root it stands for. */
const throughIncludes = (
  graph: RefGraph,
  at: { readonly file: string; readonly node: unknown; readonly pointer: Pointer }
): { readonly file: string; readonly node: unknown; readonly pointer: Pointer } => {
  const ref = includeOf(at.node)
  if (ref === undefined) return at
  const file = graph.target(at.file, ref)
  return throughIncludes(graph, { file, node: graph.trees.get(file), pointer: [] })
}

/**
 * The file a resolved position belongs to: the innermost include holding it,
 * else the config. A position that does not exist belongs to the file of its
 * nearest existing parent, the rest of the position appended.
 *
 * @param graph - the config and its partials.
 * @param position - the position in the resolved config.
 * @param options - `whole: true` follows a final include too, naming the file
 *   a node IS rather than the file that includes it.
 */
export const ownerOf = (
  graph: RefGraph,
  position: Pointer,
  options: { readonly whole?: boolean } = {}
): Owner => {
  const walk = (
    at: { readonly file: string; readonly node: unknown; readonly pointer: Pointer },
    rest: Pointer
  ): Owner => {
    const [step, ...after] = rest
    if (step === undefined) {
      const last = options.whole === true ? throughIncludes(graph, at) : at
      return { file: last.file, pointer: last.pointer }
    }
    const here = throughIncludes(graph, at)
    const child = childOf(here.node, step)
    if (child === undefined) return { file: here.file, pointer: [...here.pointer, ...rest] }
    return walk({ file: here.file, node: child, pointer: [...here.pointer, step] }, after)
  }
  return walk({ file: graph.root, node: graph.trees.get(graph.root), pointer: [] }, position)
}

/** What a file becomes, seen from one place that includes it. */
export interface Visit {
  readonly file: string
  /** The place in the resolved config the include stands at. */
  readonly position: Pointer
  readonly tree: unknown
}

/** A node a rewrite removed from, or added to, a file. */
export interface Relocated {
  readonly file: string
  readonly value: string
}

/** What rewriting one raw node produced. */
export interface Rewritten {
  readonly tree: unknown
  readonly visits: readonly Visit[]
  /** The files whose include the rewrite removed. */
  readonly dropped: readonly string[]
  readonly removed: readonly Relocated[]
  readonly added: readonly Relocated[]
}

const leaf = (tree: unknown): Rewritten => ({
  tree,
  visits: [],
  dropped: [],
  removed: [],
  added: [],
})

const joined = (parts: readonly Rewritten[]): Omit<Rewritten, 'tree'> => ({
  visits: parts.flatMap((part) => part.visits),
  dropped: parts.flatMap((part) => part.dropped),
  removed: parts.flatMap((part) => part.removed),
  added: parts.flatMap((part) => part.added),
})

/** What one rewrite walks: the graph, and the file the raw node is written in. */
interface Scope {
  readonly graph: RefGraph
  readonly file: string
}

/** The trace a raw node leaves when it is removed: the include it was, and the node. */
const removal = (scope: Scope, raw: unknown, old: unknown): Omit<Rewritten, 'tree'> => {
  const ref = includeOf(raw)
  return {
    visits: [],
    dropped: ref === undefined ? [] : [scope.graph.target(scope.file, ref)],
    removed: isRecord(old) ? [{ file: scope.file, value: canonicalJson(old) }] : [],
    added: [],
  }
}

const addition = (scope: Scope, next: unknown): Omit<Rewritten, 'tree'> => ({
  visits: [],
  dropped: [],
  removed: [],
  added: isRecord(next) ? [{ file: scope.file, value: canonicalJson(next) }] : [],
})

const rewriteList = (
  scope: Scope,
  raw: readonly unknown[],
  change: { readonly old: readonly unknown[]; readonly next: readonly unknown[] },
  position: Pointer
): Rewritten => {
  const pairs = alignLists(change.old, change.next)
  const items = change.next.map((item, j) => {
    const pair = pairs.find(([, r]) => r === j)
    if (pair === undefined) return { ...leaf(item), ...addition(scope, item) }
    const [i] = pair
    return rewriteNode(scope, raw[i], { old: change.old[i], next: item }, [...position, i])
  })
  const removed = raw.flatMap((item, i) =>
    pairs.some(([l]) => l === i)
      ? []
      : [{ ...leaf(undefined), ...removal(scope, item, change.old[i]) }]
  )
  return { tree: items.map((item) => item.tree), ...joined([...items, ...removed]) }
}

const rewriteMapping = (
  scope: Scope,
  raw: Readonly<Record<string, unknown>>,
  change: {
    readonly old: Readonly<Record<string, unknown>>
    readonly next: Readonly<Record<string, unknown>>
  },
  position: Pointer
): Rewritten => {
  const kept = Object.keys(raw).flatMap((key) =>
    Object.hasOwn(change.next, key)
      ? [
          [
            key,
            rewriteNode(scope, raw[key], { old: change.old[key], next: change.next[key] }, [
              ...position,
              key,
            ]),
          ] as const,
        ]
      : []
  )
  const gone = Object.keys(raw)
    .filter((key) => !Object.hasOwn(change.next, key))
    .map((key) => ({ ...leaf(undefined), ...removal(scope, raw[key], change.old[key]) }))
  const fresh = Object.keys(change.next)
    .filter((key) => !Object.hasOwn(raw, key))
    .map(
      (key) => [key, { ...leaf(change.next[key]), ...addition(scope, change.next[key]) }] as const
    )
  const entries = [...kept, ...fresh]
  return {
    tree: Object.fromEntries(entries.map(([key, part]) => [key, part.tree] as const)),
    ...joined([...entries.map(([, part]) => part), ...gone]),
  }
}

/** Rewrite one raw node of a file, given the resolved value it held and the one it is to hold. */
const rewriteNode = (
  scope: Scope,
  raw: unknown,
  change: { readonly old: unknown; readonly next: unknown },
  position: Pointer
): Rewritten => {
  const ref = includeOf(raw)
  if (ref !== undefined) {
    const file = scope.graph.target(scope.file, ref)
    const inner = rewriteNode({ ...scope, file }, scope.graph.trees.get(file), change, position)
    const visit: Visit = { file, position, tree: inner.tree }
    return { ...joined([inner]), tree: raw, visits: [visit, ...inner.visits] }
  }
  const { old, next } = change
  if (Array.isArray(raw) && Array.isArray(old) && Array.isArray(next)) {
    return rewriteList(scope, raw, { old, next }, position)
  }
  if (isRecord(raw) && isRecord(old) && isRecord(next)) {
    return rewriteMapping(scope, raw, { old, next }, position)
  }
  return leaf(sameTree(old, next) ? raw : next)
}

/**
 * Carry the change from one resolved config to another back to the raw trees
 * it is written in.
 *
 * @param graph - the config and its partials, each as its raw tree.
 * @param old - the config as it resolves today.
 * @param next - the config as it is to resolve.
 * @returns the config's new raw tree, and every visit of an included file.
 */
export const rewriteGraph = (graph: RefGraph, old: unknown, next: unknown): Rewritten =>
  rewriteNode({ graph, file: graph.root }, graph.trees.get(graph.root), { old, next }, [])

/** A file two counted places include, which they would write two ways. */
export interface SharedConflict {
  readonly file: string
  readonly variants: readonly {
    readonly positions: readonly Pointer[]
    readonly tree: unknown
  }[]
}

/** What the visits settle to: each included file's new tree, and the files they disagree on. */
export interface Settled {
  readonly trees: ReadonlyMap<string, unknown>
  readonly conflicts: readonly SharedConflict[]
}

/**
 * Settle every visit of each included file: one new tree when every counted
 * visit agrees, a conflict naming each variant otherwise. A visit not counted
 * (its place is not judged, say a page no board draws) never decides.
 *
 * @param visits - every visit the rewrite recorded.
 * @param counts - whether the visit at a position takes part in the judgement.
 */
export const settleVisits = (
  visits: readonly Visit[],
  counts: (position: Pointer) => boolean
): Settled => {
  const byFile = Map.groupBy(visits, (visit) => visit.file)
  const verdicts = [...byFile].map(([file, all]) => {
    const counted = all.filter((visit) => counts(visit.position))
    const deciding = counted.length === 0 ? all : counted
    const variants = [...Map.groupBy(deciding, (visit) => canonicalJson(visit.tree)).values()].map(
      (group) => ({ positions: group.map((visit) => visit.position), tree: group[0]?.tree })
    )
    return { file, variants }
  })
  return {
    trees: new Map(
      verdicts.flatMap(({ file, variants }) =>
        variants.length === 1 ? [[file, variants[0]?.tree] as const] : []
      )
    ),
    conflicts: verdicts.filter(({ variants }) => variants.length > 1),
  }
}

/**
 * Every file the config still reaches through its includes, as absolute
 * paths, reading each file's tree from `trees`.
 *
 * @param graph - the config, and how a `$ref` names a file.
 * @param trees - each file's raw tree, the new ones standing in for the old.
 */
export const reachableFiles = (
  graph: Pick<RefGraph, 'root' | 'target'>,
  trees: ReadonlyMap<string, unknown>
): ReadonlySet<string> => {
  const direct = (from: string, node: unknown): readonly string[] => {
    const ref = includeOf(node)
    if (ref !== undefined) return [graph.target(from, ref)]
    if (Array.isArray(node)) return node.flatMap((item) => direct(from, item))
    return isRecord(node) ? Object.values(node).flatMap((item) => direct(from, item)) : []
  }
  const visit = (seen: ReadonlySet<string>, file: string): ReadonlySet<string> =>
    seen.has(file) ? seen : direct(file, trees.get(file)).reduce(visit, new Set([...seen, file]))
  return visit(new Set(), graph.root)
}

/**
 * The config a set of raw trees resolves to, each include replaced by the tree
 * of the file it names: what the resolver will read once they are written.
 *
 * @param graph - the config, and how a `$ref` names a file.
 * @param trees - each file's raw tree, the new ones standing in for the old.
 */
export const resolveTrees = (
  graph: Pick<RefGraph, 'root' | 'target'>,
  trees: ReadonlyMap<string, unknown>
): unknown => {
  const resolveIn = (file: string, node: unknown): unknown => {
    const ref = includeOf(node)
    if (ref !== undefined) {
      const target = graph.target(file, ref)
      return resolveIn(target, trees.get(target))
    }
    if (Array.isArray(node)) return node.map((item) => resolveIn(file, item))
    return isRecord(node)
      ? Object.fromEntries(
          Object.entries(node).map(([key, value]) => [key, resolveIn(file, value)])
        )
      : node
  }
  return resolveIn(graph.root, trees.get(graph.root))
}
