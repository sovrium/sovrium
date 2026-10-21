/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Comparing what a locked node draws INSIDE — a template placement, an island
 * — with what an unedited export draws there, from the digests a tool parser
 * computes (`page-drawing.ts`).
 *
 * Two digests compare as the strings they differ by, or not at all:
 *
 * - When both are the same document but for some strings, the answer is
 *   those strings, each with its unedited and its drawn value.
 * - A digest whose root says it is ADDITIVE (a Claude Design board, over
 *   which a prototype may add its own markup without editing the export) may
 *   hold elements the unedited one does not: they are the prototype layer,
 *   set aside before comparing. Every element the export drew must still be
 *   there, in order. In it, a string the export drew as a PLACEHOLDER — a
 *   bound value drawn as its field name in brackets (`[name]`), a route
 *   parameter drawn as `1` — matches any drawn value that fills the holes and
 *   keeps the rest, so a sample value shown in its place is no edit.
 * - Anything else — an element gone, reordered or retyped — is a change of
 *   structure, answered `undefined`, which the caller reports whole.
 *
 * Pure: the same two digests always compare the same way.
 */

/** One string a digest reads differently. */
export interface StringChange {
  readonly before: string
  readonly after: string
}

type Node = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A bound value's field name in brackets, as the export draws it, alternatives included. */
const PLACEHOLDER = /\[[a-z][\w.]*\](?:\|\[[a-z][\w.]*\])*/g

/** A route parameter, as the export draws it. */
const ROUTE_PARAMETER = /^1\*?$/

const escapeRegExp = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whether a drawn text is the unedited one, or that one with its placeholders
 * filled: every character outside a placeholder is kept, in order.
 *
 * @param before - the text an unedited export draws.
 * @param after - the text the drawing holds.
 */
export const fillsPlaceholders = (before: string, after: string): boolean => {
  if (before === after) return true
  if (ROUTE_PARAMETER.test(before.trim())) return after.trim() !== ''
  const parts = before.split(PLACEHOLDER)
  if (parts.length === 1) return false
  return new RegExp(`^${parts.map(escapeRegExp).join('[\\s\\S]*?')}$`).test(after)
}

/** How an item of a digest list is recognised: a text, a slotted node, or an element by its tag. */
const kindOf = (item: unknown): string => {
  if (typeof item === 'string') return 'text'
  if (!isObject(item)) return JSON.stringify(item)
  return JSON.stringify([item['tag'], item['nodeType'], item['slotted']])
}

/**
 * The drawn list pruned to the items an unedited one holds, matched in order:
 * an equal item first, else one of the same kind. `undefined` when an
 * unedited item has no drawn match left.
 */
const alignedList = (
  before: readonly unknown[],
  after: readonly unknown[]
): readonly unknown[] | undefined => {
  const step = before.reduce<
    { readonly kept: readonly unknown[]; readonly from: number } | undefined
  >(
    (acc, item) => {
      if (acc === undefined) return undefined
      const rest = after.slice(acc.from)
      const equal = rest.findIndex(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(item)
      )
      const similar = rest.findIndex((candidate) => kindOf(candidate) === kindOf(item))
      const at = equal === -1 ? similar : equal
      return at === -1 ? undefined : { kept: [...acc.kept, rest[at]], from: acc.from + at + 1 }
    },
    { kept: [], from: 0 }
  )
  return step?.kept
}

/** A drawn digest set to the shape of the unedited one, the prototype layer set aside. */
const aligned = (before: unknown, after: unknown): unknown => {
  if (Array.isArray(before) && Array.isArray(after)) {
    const kept = alignedList(before, after)
    return kept === undefined ? after : kept.map((item, index) => aligned(before[index], item))
  }
  if (isObject(before) && isObject(after)) {
    return Object.fromEntries(
      Object.entries(after).map(([key, value]) => [key, aligned(before[key], value)])
    )
  }
  return after
}

const sameKeys = (a: Node, b: Node): boolean =>
  Object.keys(a).toSorted().join('\u0000') === Object.keys(b).toSorted().join('\u0000')

const collect = (
  parts: readonly (readonly StringChange[] | undefined)[]
): readonly StringChange[] | undefined =>
  parts.some((part) => part === undefined) ? undefined : parts.flatMap((part) => part ?? [])

/**
 * The strings that differ between two documents of one shape, or `undefined`
 * when their shapes differ; with `samples`, a filled placeholder is no change.
 */
function stringChanges(
  before: unknown,
  after: unknown,
  samples: boolean
): readonly StringChange[] | undefined {
  if (typeof before === 'string' && typeof after === 'string') {
    const same = samples ? fillsPlaceholders(before, after) : before === after
    return same ? [] : [{ before, after }]
  }
  if (Array.isArray(before) && Array.isArray(after)) return listChanges(before, after, samples)
  if (isObject(before) && isObject(after)) return mappingChanges(before, after, samples)
  return before === after ? [] : undefined
}

/** Two lists of one length, item by item. */
const listChanges = (
  before: readonly unknown[],
  after: readonly unknown[],
  samples: boolean
): readonly StringChange[] | undefined =>
  before.length === after.length
    ? collect(before.map((item, index) => stringChanges(item, after[index], samples)))
    : undefined

/** Two mappings with one key set, key by key. */
const mappingChanges = (
  before: Node,
  after: Node,
  samples: boolean
): readonly StringChange[] | undefined =>
  sameKeys(before, after)
    ? collect(Object.keys(before).map((key) => stringChanges(before[key], after[key], samples)))
    : undefined

/** The JSON a digest holds, or `undefined` when it is no JSON at all. */
const parsed = (digest: string): unknown => {
  try {
    return JSON.parse(digest) as unknown
  } catch {
    // A digest a tool did not write as JSON is compared whole, never read.
    return undefined
  }
}

/**
 * The strings two digests of one locked node differ by, or `undefined` when
 * the drawing changed more than strings.
 *
 * @param digests - what the node draws inside, unedited and as drawn.
 */
export const digestChanges = (digests: {
  readonly baseline: string | undefined
  readonly drawn: string | undefined
}): readonly StringChange[] | undefined => {
  if (digests.baseline === digests.drawn) return []
  if (digests.baseline === undefined || digests.drawn === undefined) return undefined
  const before = parsed(digests.baseline)
  const after = parsed(digests.drawn)
  if (before === undefined || after === undefined) return undefined
  const additive = isObject(before) && before['additive'] === true
  return additive
    ? stringChanges(before, aligned(before, after), true)
    : stringChanges(before, after, false)
}
