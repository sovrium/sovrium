/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A reader of Transit JSON (Cognitect Transit, non-verbose), the encoding a
 * Retool workflow export stores its block bodies in.
 *
 * What it reads:
 *
 * - **The write cache.** A map key longer than three characters, and a tag,
 *   keyword or symbol string (`~#…`, `~:…`, `~$…`) longer than three, is
 *   remembered in the order it is read; a later `^N` (one or two base-44
 *   digits from `0`) stands for it. The cache restarts after 44 × 44 entries,
 *   as the writer's does.
 * - **Maps written as arrays**, `["^ ", key, value, …]`, and tagged values,
 *   `["~#tag", rep]`.
 * - **Scalars**: `~m<epoch ms>` is a number of milliseconds, `~i` and `~d`
 *   numbers, `~?t`/`~?f` booleans, `~_` null, `~~`, `~^` and `` ~` `` escapes;
 *   a keyword, symbol, UUID, URI, instant or big number keeps its text.
 * - **Immutable.js tags** (`transit-immutable-js`): a map (`iM`, `iOM`) as a
 *   plain object, a list or set (`iL`, `iS`, `iOS`, `iStk`) as an array, and a
 *   record (`iR`, `{ n: <name>, v: <values> }`) as its values.
 *
 * Any other tag is kept as `{ tag, rep }`. Nothing is evaluated: the result
 * is plain data.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/** A tagged value whose tag the reader does not unfold. */
export interface TransitTagged {
  readonly tag: string
  readonly rep: unknown
}

type Cache = readonly string[]

/** A value read, and the cache as it stands after reading it. */
interface Read {
  readonly value: unknown
  readonly cache: Cache
}

const CACHE_DIGITS = 44
const CACHE_ZERO = 48
const CACHE_SIZE = CACHE_DIGITS * CACHE_DIGITS
const MAP_MARKER = '^ '

const isCacheReference = (text: string): boolean =>
  text !== MAP_MARKER && text.startsWith('^') && text.length >= 2 && text.length <= 3

const cacheIndex = (text: string): number => {
  const first = text.charCodeAt(1) - CACHE_ZERO
  return text.length === 2 ? first : first * CACHE_DIGITS + text.charCodeAt(2) - CACHE_ZERO
}

const isCacheable = (text: string, asKey: boolean): boolean =>
  text.length > 3 && (asKey || /^~[#:$]/.test(text))

const remember = (cache: Cache, text: string): Cache =>
  cache.length >= CACHE_SIZE ? [text] : [...cache, text]

/** A string as written, resolved through the cache, and the cache after it. */
const readRaw = (text: string, cache: Cache, asKey: boolean): Read =>
  isCacheReference(text)
    ? { value: cache[cacheIndex(text)] ?? text, cache }
    : { value: text, cache: isCacheable(text, asKey) ? remember(cache, text) : cache }

const SPECIAL_NUMBERS: Readonly<Record<string, number>> = {
  NaN: Number.NaN,
  INF: Number.POSITIVE_INFINITY,
  '-INF': Number.NEGATIVE_INFINITY,
}

const escaped = (text: string): string => text.slice(1)
const numeric = (text: string): number => Number(text.slice(2))

/** How a `~x` scalar is read, by its marker `x`; any other marker keeps the text after it. */
const SCALAR_READERS: Readonly<Record<string, (text: string) => unknown>> = {
  '~': escaped,
  '^': escaped,
  '`': escaped,
  // eslint-disable-next-line unicorn/no-null -- Transit's `~_` IS JSON null; the decoded document is plain JSON data
  _: () => null,
  '?': (text) => text.slice(2) === 't',
  m: numeric,
  i: numeric,
  d: numeric,
  z: (text) => SPECIAL_NUMBERS[text.slice(2)] ?? text,
  '#': (text) => text,
}

/** What a scalar string stands for. */
const scalarOf = (text: string): unknown => {
  if (!text.startsWith('~') || text.length < 2) return text
  const reader = SCALAR_READERS[text.charAt(1)]
  return reader === undefined ? text.slice(2) : reader(text)
}

/** A flat `[key, value, …]` list as an object. */
const objectOfPairs = (pairs: readonly unknown[]): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    pairs.flatMap((key, index) =>
      index % 2 === 0
        ? [[typeof key === 'string' ? key : JSON.stringify(key), pairs[index + 1]] as const]
        : []
    )
  )

/** A tagged value, unfolded when its tag is one the reader knows. */
const unfold = (tag: string, rep: unknown): unknown => {
  if (tag === "'") return rep
  if ((tag === 'iM' || tag === 'iOM' || tag === 'cmap') && Array.isArray(rep)) {
    return objectOfPairs(rep)
  }
  if (['iL', 'iS', 'iOS', 'iStk', 'list', 'set'].includes(tag)) return rep
  if (tag === 'iR' && isRecord(rep)) return rep['v']
  return { tag, rep } satisfies TransitTagged
}

/** Several values read in order, the cache threaded through. */
const readAll = (nodes: readonly unknown[], cache: Cache, keys: boolean): Read =>
  nodes.reduce<{ readonly value: readonly unknown[]; readonly cache: Cache }>(
    (state, node, index) => {
      const read = readNode(node, state.cache, keys && index % 2 === 0)
      return { value: [...state.value, read.value], cache: read.cache }
    },
    { value: [], cache }
  )

const readArray = (node: readonly unknown[], cache: Cache): Read => {
  const [head, rep] = node
  if (head === MAP_MARKER) {
    const pairs = readAll(node.slice(1), cache, true)
    return { value: objectOfPairs(pairs.value as readonly unknown[]), cache: pairs.cache }
  }
  if (node.length === 2 && typeof head === 'string') {
    const tag = readRaw(head, cache, false)
    const tagText = String(tag.value)
    if (tagText.startsWith('~#')) {
      const read = readNode(rep, tag.cache, false)
      return { value: unfold(tagText.slice(2), read.value), cache: read.cache }
    }
    const second = readNode(rep, tag.cache, false)
    return { value: [scalarOf(tagText), second.value], cache: second.cache }
  }
  return readAll(node, cache, false)
}

const readObject = (node: Readonly<Record<string, unknown>>, cache: Cache): Read => {
  const pairs = readAll(
    Object.entries(node).flatMap(([key, value]) => [key, value]),
    cache,
    true
  )
  const [first] = Object.keys(node)
  const values = pairs.value as readonly unknown[]
  return typeof first === 'string' && first.startsWith('~#') && values.length === 2
    ? { value: unfold(first.slice(2), values[1]), cache: pairs.cache }
    : { value: objectOfPairs(values), cache: pairs.cache }
}

function readNode(node: unknown, cache: Cache, asKey: boolean): Read {
  if (typeof node === 'string') {
    const raw = readRaw(node, cache, asKey)
    return { value: scalarOf(String(raw.value)), cache: raw.cache }
  }
  if (Array.isArray(node)) return readArray(node, cache)
  return isRecord(node) ? readObject(node, cache) : { value: node, cache }
}

/** A parsed Transit JSON document as plain data. */
export const decodeTransitValue = (document: unknown): unknown =>
  readNode(document, [], false).value

/** A Transit JSON string as plain data, or `undefined` when it is not JSON. */
export const decodeTransitJson = (text: string): unknown => {
  try {
    return decodeTransitValue(JSON.parse(text) as unknown)
  } catch {
    // Not JSON at all: the caller reports the block bodies as unreadable.
    return undefined
  }
}
