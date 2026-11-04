/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, SynchronizedRef } from 'effect'
import { VisitorSecret } from '@/application/ports/services/visitor-secret'

/** The day a key belongs to, and the key. */
interface HeldKey {
  readonly day: string
  readonly key: CryptoKey
}

/**
 * A fresh 256-bit HMAC SHA-256 key, generated inside Web Crypto and
 * non-extractable: its bytes never reach JavaScript memory, so there is
 * nothing to overwrite when it is dropped.
 */
const freshKey = (): Effect.Effect<CryptoKey> =>
  // effect-promise: total -- HMAC with SHA-256 and a 256-bit length is a mandatory Web Crypto algorithm and every parameter is a constant, so generation has no rejection path.
  Effect.promise(() =>
    crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'])
  )

/**
 * The key to hand out for `day`, and the key to hold afterwards.
 *
 * Only the newest day is ever held. A later day replaces it with a fresh key;
 * an earlier day (a request that read its day just before midnight and asks
 * after a newer one has moved on) gets a one-off key that is never held, so
 * the current day keeps its own. Days are `YYYY-MM-DD`, so their string order
 * is their calendar order.
 */
const nextHeld = (
  current: HeldKey | undefined,
  day: string
): Effect.Effect<readonly [CryptoKey, HeldKey | undefined]> => {
  if (current !== undefined && current.day === day) return Effect.succeed([current.key, current])
  if (current !== undefined && day < current.day)
    return freshKey().pipe(Effect.map((oneOff) => [oneOff, current] as const))
  return freshKey().pipe(Effect.map((key) => [key, { day, key }] as const))
}

/**
 * {@link VisitorSecret} held in memory by the server runtime that builds it.
 *
 * Scoped to that runtime (standing rule E3): every server, including a second
 * boot inside the same process, builds its own and starts without a key.
 * Never module-level, which is what makes a restart start a new day of
 * identifiers. Rotation runs under the ref's lock, so two requests crossing
 * midnight together agree on one key for the new day.
 */
export const VisitorSecretLive = Layer.effect(
  VisitorSecret,
  Effect.gen(function* () {
    const held = yield* SynchronizedRef.make<HeldKey | undefined>(undefined)
    return {
      keyFor: (day: string) =>
        SynchronizedRef.modifyEffect(held, (current) => nextHeld(current, day)),
    }
  })
)
