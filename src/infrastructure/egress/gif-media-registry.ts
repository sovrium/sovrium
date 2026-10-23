/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which provider address a GIF id stands for, as the provider answered it.
 *
 * The GIF routes serve a GIF by id, never by an address a caller sends; the
 * address is the one the provider itself gave the server, in a search answer
 * or in its answer to the connection's `get` lookup. Remembered here, by
 * connection and id, for a day; bounded by count. A lookup by id the provider
 * answered with nothing is remembered as such for an hour, and lookups by id
 * are capped per hour, so a caller cycling through ids cannot spend the
 * operator's quota.
 *
 * Process state: a restart forgets it, and the next ask looks the id up again.
 */

/** The provider addresses of one GIF. @public */
export interface GifMediaAddresses {
  readonly original: string
  readonly preview: string
}

const KEEP_MS = 24 * 60 * 60 * 1000
const MISS_MS = 60 * 60 * 1000
const MAX_ENTRIES = 5000
/** Lookups by id sent to a provider per hour, every connection together. */
const LOOKUPS_PER_HOUR = 120

const known = new Map<string, { readonly at: number; readonly media: GifMediaAddresses }>()
const missing = new Map<string, number>()
let lookups: readonly number[] = []

const keyOf = (connection: string, id: string): string => `${connection}\u0000${id}`

/** Remember the addresses of the GIFs a provider answered. @public */
export const rememberGifMedia = (
  connection: string,
  picks: readonly { readonly id: string; readonly media: GifMediaAddresses }[]
): void => {
  const now = Date.now()
  picks.forEach(({ id, media }) => {
    const key = keyOf(connection, id)
    known.delete(key)
    known.set(key, { at: now, media })
    missing.delete(key)
  })
  while (known.size > MAX_ENTRIES) {
    const oldest = known.keys().next().value
    if (oldest === undefined) break
    known.delete(oldest)
  }
}

/** The remembered addresses of a GIF, or `undefined`. @public */
export const knownGifMedia = (connection: string, id: string): GifMediaAddresses | undefined => {
  const entry = known.get(keyOf(connection, id))
  return entry !== undefined && Date.now() - entry.at < KEEP_MS ? entry.media : undefined
}

/** Remember that the provider knows no GIF by this id. @public */
export const rememberMissingGif = (connection: string, id: string): void => {
  const now = Date.now()
  // Misses outlive their hour nowhere: the map holds at most an hour of lookups.
  missing.forEach((at, key) => {
    if (now - at >= MISS_MS) missing.delete(key)
  })
  missing.set(keyOf(connection, id), now)
}

/**
 * Whether a lookup of this id may be sent to the provider now: not one it
 * answered with nothing within the hour, and within the hourly budget — which
 * a `true` answer spends. @public
 */
export const mayLookUpGif = (connection: string, id: string): boolean => {
  const now = Date.now()
  const missedAt = missing.get(keyOf(connection, id))
  if (missedAt !== undefined && now - missedAt < MISS_MS) return false
  lookups = lookups.filter((at) => now - at < MISS_MS)
  if (lookups.length >= LOOKUPS_PER_HOUR) return false
  lookups = [...lookups, now]
  return true
}
