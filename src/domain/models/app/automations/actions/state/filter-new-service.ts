/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure selection logic behind `state` / `filterNew`: given a page of items,
 * what the step remembered from its previous runs, and its props, decide
 * which items are new and what to remember next.
 */

export interface FilterNewMemory {
  /** Keys already returned, most recent first. `undefined` on the very first run. */
  readonly seen: readonly string[] | undefined
  /** Highest cursor value stored, when a cursor is configured. */
  readonly cursor: unknown
}

export interface FilterNewOptions {
  readonly key: string
  readonly cursorField?: string
  readonly initial: 'skip' | 'emit'
  readonly remember: number
}

export interface FilterNewResult {
  readonly items: readonly unknown[]
  readonly seen: readonly string[]
  /** The cursor value to store, or `undefined` when nothing moves it. */
  readonly cursor: unknown
}

/** Read a plain field name or a dot path (`meta.id`) off an item. */
export const readItemField = (item: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (value, segment) =>
        value !== null && typeof value === 'object'
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      item
    )

const isPresent = (value: unknown): boolean => value !== undefined && value !== null && value !== ''

const asComparable = (value: unknown): number | string => {
  if (typeof value === 'number') return value
  const text = String(value)
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  const time = Date.parse(text)
  return Number.isNaN(time) ? text : time
}

/** Compare two cursor values: numbers numerically, ISO dates by instant, else as text. */
export const compareCursorValues = (left: unknown, right: unknown): number => {
  const a = asComparable(left)
  const b = asComparable(right)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const sa = String(a)
  const sb = String(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

const highestCursor = (items: readonly unknown[], field: string, start: unknown): unknown =>
  items
    .map((item) => readItemField(item, field))
    .filter(isPresent)
    .reduce<unknown>(
      (highest, value) =>
        !isPresent(highest) || compareCursorValues(value, highest) > 0 ? value : highest,
      start
    )

const keyOf = (item: unknown, key: string): string | undefined => {
  const value = readItemField(item, key)
  return isPresent(value) ? String(value) : undefined
}

const mergeSeen = (
  returned: readonly string[],
  previous: readonly string[],
  remember: number
): readonly string[] => {
  const fresh = [...new Set(returned.toReversed())]
  return [...fresh, ...previous.filter((k) => !fresh.includes(k))].slice(0, remember)
}

/**
 * Keep the items whose key was never returned and whose cursor value is above
 * the stored one. On the first run with `initial: skip`, return nothing and
 * remember everything already there.
 */
export const selectNewItems = (
  items: readonly unknown[],
  memory: FilterNewMemory,
  options: FilterNewOptions
): FilterNewResult => {
  const { key, cursorField, initial, remember } = options
  const firstRun = memory.seen === undefined
  const previous = memory.seen ?? []
  const keyed = items.filter((item) => keyOf(item, key) !== undefined)

  const candidates = keyed.reduce<{
    readonly out: readonly unknown[]
    readonly keys: readonly string[]
  }>(
    (acc, item) => {
      const k = keyOf(item, key) as string
      if (previous.includes(k) || acc.keys.includes(k)) return acc
      if (cursorField !== undefined && isPresent(memory.cursor)) {
        const value = readItemField(item, cursorField)
        if (isPresent(value) && compareCursorValues(value, memory.cursor) <= 0) return acc
      }
      return { out: [...acc.out, item], keys: [...acc.keys, k] }
    },
    { out: [], keys: [] }
  )

  const returned = firstRun && initial === 'skip' ? [] : candidates.out
  const remembered = firstRun && initial === 'skip' ? keyed : candidates.out
  const rememberedKeys = remembered.map((item) => keyOf(item, key) as string)
  const cursor =
    cursorField === undefined ? undefined : highestCursor(remembered, cursorField, memory.cursor)

  return {
    items: returned,
    seen: mergeSeen(rememberedKeys, previous, remember),
    cursor: cursor === memory.cursor ? undefined : cursor,
  }
}
