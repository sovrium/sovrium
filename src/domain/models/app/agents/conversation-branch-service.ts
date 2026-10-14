/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A chat conversation as a tree of messages.
 *
 * Editing a question or regenerating an answer never overwrites a message: it
 * adds a SIBLING, a message with the same parent. A conversation is therefore a
 * tree, and what the user reads is one path through it, its branch.
 *
 * - The CURRENT branch is the one holding the conversation's newest message.
 *   Every write is stamped after everything already there, so a turn continues
 *   it, and an edit or a regeneration — wherever the reader was — becomes
 *   current the moment it is written.
 * - A branch THROUGH a given message is the path from the first message down to
 *   it, continued below it by the newest child: that is how a reader pages to
 *   an older sibling and still sees the rest of its branch.
 *
 * Every function here is pure: the repository hands it the conversation's
 * messages and writes what it decides.
 */

/** The fields of a message the tree is built from. */
export interface BranchNode {
  readonly id: string
  readonly parentId: string | null
  readonly createdAt: Date
}

/** Oldest first; the id breaks a tie so the order never depends on the driver. */
const chronological = <T extends BranchNode>(a: T, b: T): number => {
  const delta = a.createdAt.getTime() - b.createdAt.getTime()
  if (delta !== 0) return delta
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * A conversation indexed once, so every walk below costs one lookup per level
 * rather than a scan of the whole conversation: a long thread is read on every
 * turn and every page.
 */
interface IndexedTree<T extends BranchNode> {
  readonly byId: ReadonlyMap<string, T>
  /** Each parent's children, oldest first (`null`: the first messages). */
  readonly children: ReadonlyMap<string | null, ReadonlyArray<T>>
  /** Bounds every walk, so a corrupt parent cycle ends rather than loops. */
  readonly size: number
}

const indexed = <T extends BranchNode>(nodes: ReadonlyArray<T>): IndexedTree<T> => ({
  byId: new Map(nodes.map((node) => [node.id, node] as const)),
  children: Map.groupBy(nodes.toSorted(chronological), (node) => node.parentId),
  size: nodes.length,
})

/** Follow the newest child from `from` (excluded) down to a leaf. */
const descendNewest = <T extends BranchNode>(
  tree: IndexedTree<T>,
  from: string | null,
  budget: number
): ReadonlyArray<T> => {
  if (budget <= 0) return []
  const newest = tree.children.get(from)?.at(-1)
  return newest === undefined ? [] : [newest, ...descendNewest(tree, newest.id, budget - 1)]
}

/**
 * The path from the first message down to `node`, `node` included. A parent
 * that is not in the conversation ends the path there.
 */
const ancestry = <T extends BranchNode>(
  tree: IndexedTree<T>,
  node: T,
  budget: number
): ReadonlyArray<T> => {
  const parent = node.parentId === null ? undefined : tree.byId.get(node.parentId)
  return parent === undefined || budget <= 0
    ? [node]
    : [...ancestry(tree, parent, budget - 1), node]
}

/** The path down to `node`, then the newest child below it, down to a leaf. */
const branchOf = <T extends BranchNode>(tree: IndexedTree<T>, node: T): ReadonlyArray<T> => [
  ...ancestry(tree, node, tree.size),
  ...descendNewest(tree, node.id, tree.size),
]

/**
 * A lookup of each message's alternatives — itself and the messages with the
 * same parent — oldest first. Build it once per conversation and ask it per
 * message.
 */
export const siblingsLookup = <T extends BranchNode>(
  nodes: ReadonlyArray<T>
): ((node: T) => ReadonlyArray<T>) => {
  const { children } = indexed(nodes)
  return (node) => children.get(node.parentId) ?? [node]
}

/**
 * The path from the first message down to `messageId`, included: the history a
 * turn written below that message replays. Empty for `null` (a turn written
 * as a new first message) and for a message the conversation does not hold.
 */
export const pathTo = <T extends BranchNode>(
  nodes: ReadonlyArray<T>,
  messageId: string | null
): ReadonlyArray<T> => {
  const tree = indexed(nodes)
  const node = messageId === null ? undefined : tree.byId.get(messageId)
  return node === undefined ? [] : ancestry(tree, node, tree.size)
}

/**
 * The conversation's current branch: the one holding its NEWEST message, from
 * the first message down to it (and on, should a same-instant tie leave the
 * newest above a leaf).
 *
 * Every write is stamped after every message already in the conversation
 * (`nextInstant`), so the newest message is the last one written: a turn
 * continues the current branch, and an edit or a regeneration — on whichever
 * branch the reader was paging — becomes current with the whole path above it.
 * Following the newest child level by level from the top would not: an answer
 * regenerated under an older alternative of an earlier question is the newest
 * of ITS siblings while that earlier question is not, and the walk would leave
 * it out.
 */
export const currentBranch = <T extends BranchNode>(nodes: ReadonlyArray<T>): ReadonlyArray<T> => {
  const newest = nodes.reduce<T | undefined>(
    (latest, node) => (latest === undefined || chronological(latest, node) < 0 ? node : latest),
    undefined
  )
  return newest === undefined ? [] : branchOf(indexed(nodes), newest)
}

/**
 * The branch through `messageId`: the path down to it, then the newest child
 * below it. `undefined` when the conversation holds no such message.
 */
export const branchThrough = <T extends BranchNode>(
  nodes: ReadonlyArray<T>,
  messageId: string
): ReadonlyArray<T> | undefined => {
  const tree = indexed(nodes)
  const node = tree.byId.get(messageId)
  return node === undefined ? undefined : branchOf(tree, node)
}

/** The last message of the current branch, where a new turn attaches. */
export const currentLeaf = <T extends BranchNode>(nodes: ReadonlyArray<T>): T | undefined =>
  currentBranch(nodes).at(-1)

/**
 * The instant (epoch milliseconds) a new message must carry to sort after
 * every message already in the conversation, so it is the newest of its
 * siblings even when the clock has not moved since the last write.
 */
export const nextInstant = (nodes: ReadonlyArray<BranchNode>, nowMs: number): number => {
  const latest = nodes.reduce((max, node) => Math.max(max, node.createdAt.getTime()), 0)
  return Math.max(nowMs, latest + 1)
}
