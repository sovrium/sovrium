/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The in-memory store behind AI-chat confirmation tokens.
 *
 * A token is short-lived working state, not durable data — the same
 * ephemeral-Map discipline as the conversation store. Three bounds hold here:
 *
 *  - **Owner.** A token is redeemable only by the person it was issued to. A
 *    token presented by anyone else is answered as unknown and is NOT consumed,
 *    so its owner can still confirm it before it expires.
 *  - **Lifetime.** An entry older than the TTL is absent, and is dropped both
 *    on the way past a lookup and on every insert.
 *  - **Size.** At most `maxEntries` tokens are held; inserting past the cap
 *    evicts the oldest one (a Map iterates in insertion order).
 */

/** What every stored confirmation carries for the store to judge it. */
export interface OwnedConfirmation {
  /** The id of the person the token was issued to. */
  readonly userId: string
  /** `Date.now()` at issue time — the TTL anchor. */
  readonly issuedAt: number
}

/** Store construction options; `now` is the test seam for the clock. */
export interface ConfirmationStoreOptions {
  readonly maxEntries: number
  readonly ttlMs: () => number
  readonly now?: () => number
}

/** A bounded, owner-checked token store. */
export interface ConfirmationStore<T extends OwnedConfirmation> {
  /** Stash an entry under its token, sweeping expired entries and enforcing the cap. */
  readonly put: (token: string, entry: T) => void
  /**
   * Redeem a token for the person presenting it. Answers `undefined` for an
   * unknown or expired token, and for a token issued to someone else — which
   * stays stored.
   */
  readonly take: (token: string, presenterUserId: string) => T | undefined
  /** Number of entries currently held (expired ones included until swept). */
  readonly size: () => number
}

/** Build a confirmation store. */
export const createConfirmationStore = <T extends OwnedConfirmation>(
  options: ConfirmationStoreOptions
): ConfirmationStore<T> => {
  const entries = new Map<string, T>()
  const now = options.now ?? Date.now
  const isExpired = (entry: T, at: number, ttlMs: number): boolean => at - entry.issuedAt > ttlMs

  const sweepExpired = (): void => {
    const at = now()
    const ttlMs = options.ttlMs()
    const expired = [...entries].filter(([, entry]) => isExpired(entry, at, ttlMs))
    expired.forEach(([token]) => entries.delete(token))
  }

  const evictOldestBeyond = (limit: number): void => {
    const excess = entries.size - limit
    if (excess <= 0) return
    const oldest = [...entries.keys()].slice(0, excess)
    oldest.forEach((token) => entries.delete(token))
  }

  return {
    put: (token, entry) => {
      sweepExpired()
      evictOldestBeyond(Math.max(options.maxEntries - 1, 0))
      entries.set(token, entry)
    },
    take: (token, presenterUserId) => {
      const stored = entries.get(token)
      if (stored === undefined) return undefined
      if (isExpired(stored, now(), options.ttlMs())) {
        entries.delete(token)
        return undefined
      }
      if (stored.userId !== presenterUserId) return undefined
      entries.delete(token)
      return stored
    },
    size: () => entries.size,
  }
}
