/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Comparing two JSON-shaped trees: whether they hold the same values whatever
 * the order of their keys, where they first differ, and how the items of an
 * old list map to the items of a new one. The `$ref` write-back
 * (`ref-write-back.ts`) aligns each list it rewrites with these, so an item
 * moved within its list keeps its raw form.
 */

import { isRecord } from './plain-object'

/** One step of a position: a key, or an index. */
export type Segment = string | number

/** A position in a tree, from its root. */
export type Pointer = readonly Segment[]

/** A value with its object keys sorted, as text: two trees are the same when this is. */
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, node: unknown) =>
    isRecord(node)
      ? Object.fromEntries(
          Object.keys(node)
            .toSorted()
            .map((key) => [key, node[key]] as const)
        )
      : node
  ) ?? 'undefined'

/** Whether two trees hold the same values, whatever the order of their keys. */
export const sameTree = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b)

/** The child of a list or mapping at one step, or `undefined`. */
export const childOf = (node: unknown, step: Segment): unknown =>
  Array.isArray(node) || isRecord(node)
    ? (node as Readonly<Record<string | number, unknown>>)[step]
    : undefined

/** The first position at which two trees differ, or `undefined` when they are the same. */
export const firstDifference = (a: unknown, b: unknown, at: Pointer = []): Pointer | undefined => {
  if (sameTree(a, b)) return undefined
  const containers = (Array.isArray(a) && Array.isArray(b)) || (isRecord(a) && isRecord(b))
  if (!containers) return at
  const keys = [...new Set([...Object.keys(a as object), ...Object.keys(b as object)])]
  const step = keys.find((key) => !sameTree(childOf(a, key), childOf(b, key)))
  return step === undefined
    ? at
    : firstDifference(childOf(a, step), childOf(b, step), [...at, step])
}

/** The value at a position of a tree. */
export const valueAt = (tree: unknown, pointer: Pointer): unknown =>
  pointer.reduce<unknown>((node, step) => childOf(node, step), tree)

const IDENTITY_KEYS = ['key', 'name', 'id'] as const

/** What tells two items of a list apart when their content changed: a `key`, `name` or `id`. */
const identityOf = (item: unknown): string | undefined => {
  if (!isRecord(item)) return undefined
  const found = IDENTITY_KEYS.find((key) => typeof item[key] === 'string')
  return found === undefined ? undefined : `${found}=${String(item[found])}`
}

type Pair = readonly [number, number]

/** The longest run of equal items two lists share, as index pairs. */
const commonPairs = (a: readonly string[], b: readonly string[]): readonly Pair[] => {
  const width = b.length + 1
  const table = a.reduceRight<readonly (readonly number[])[]>(
    (rows, item) => {
      const below = rows[0] ?? []
      const row = b.reduceRight<readonly number[]>(
        (acc, other, j) => [
          item === other ? (below[j + 1] ?? 0) + 1 : Math.max(below[j] ?? 0, acc[0] ?? 0),
          ...acc,
        ],
        [0]
      )
      return [row, ...rows]
    },
    [Array.from({ length: width }, () => 0)]
  )
  const walk = (i: number, j: number): readonly Pair[] => {
    if (i >= a.length || j >= b.length) return []
    if (a[i] === b[j]) return [[i, j], ...walk(i + 1, j + 1)]
    return (table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0) ? walk(i + 1, j) : walk(i, j + 1)
  }
  return walk(0, 0)
}

/** Pair the items left over by a matcher: each `right` item to the first free `left` one it takes. */
const pairBy = (
  left: readonly number[],
  right: readonly number[],
  matches: (l: number, r: number) => boolean
): readonly Pair[] =>
  right.reduce<readonly Pair[]>((acc, r) => {
    const l = left.find(
      (candidate) => !acc.some(([used]) => used === candidate) && matches(candidate, r)
    )
    return l === undefined ? acc : [...acc, [l, r] as const]
  }, [])

/** How the items of an old list map to a new one: equal items, then the same identity, then order. */
export const alignLists = (old: readonly unknown[], next: readonly unknown[]): readonly Pair[] => {
  const a = old.map(canonicalJson)
  const b = next.map(canonicalJson)
  const free = (pairs: readonly Pair[]) => ({
    left: a.flatMap((_, i) => (pairs.some(([l]) => l === i) ? [] : [i])),
    right: b.flatMap((_, j) => (pairs.some(([, r]) => r === j) ? [] : [j])),
  })
  const steps: readonly ((l: number, r: number) => boolean)[] = [
    (l, r) => a[l] === b[r],
    (l, r) => identityOf(old[l]) !== undefined && identityOf(old[l]) === identityOf(next[r]),
    () => true,
  ]
  return steps.reduce<readonly Pair[]>(
    (pairs, matches) => {
      const { left, right } = free(pairs)
      return [...pairs, ...pairBy(left, right, matches)]
    },
    commonPairs(a, b)
  )
}
