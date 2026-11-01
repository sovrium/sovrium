/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer, Ref } from 'effect'
import { VisitorSecret } from '@/application/ports/services/visitor-secret'

/** The day a secret belongs to, and the secret. */
interface HeldSecret {
  readonly day: string
  readonly secret: Uint8Array<ArrayBuffer>
}

/** 32 random bytes from the platform's cryptographic generator. */
const freshSecret = (): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(32))

/**
 * The secret to hand out for `day`, and the secret to hold afterwards.
 *
 * Only the newest day is ever held. A later day replaces it with a fresh secret
 * and overwrites the one it replaces with zeros; an earlier day (a request that
 * read its day just before midnight and asks after a newer one has moved on)
 * gets a one-off secret that is never held, so the current day keeps its own.
 * Days are `YYYY-MM-DD`, so their string order is their calendar order.
 */
const nextHeld = (
  current: HeldSecret | undefined,
  day: string
): readonly [Uint8Array<ArrayBuffer>, HeldSecret | undefined] => {
  if (current === undefined) {
    const first = { day, secret: freshSecret() }
    return [first.secret, first]
  }
  if (current.day === day) return [current.secret, current]
  if (day < current.day) return [freshSecret(), current]
  current.secret.fill(0)
  const next = { day, secret: freshSecret() }
  return [next.secret, next]
}

/**
 * {@link VisitorSecret} held in memory by the server runtime that builds it.
 *
 * Scoped to that runtime (standing rule E3): every server, including a second
 * boot inside the same process, builds its own and starts without a secret, and
 * the secret in hand is overwritten with zeros when the runtime is disposed.
 * Never module-level, which is what makes a restart start a new day of
 * identifiers.
 */
export const VisitorSecretLive = Layer.effect(
  VisitorSecret,
  Effect.gen(function* () {
    const held = yield* Effect.acquireRelease(Ref.make<HeldSecret | undefined>(undefined), (ref) =>
      Ref.get(ref).pipe(Effect.map((current) => current?.secret.fill(0)))
    )
    return {
      secretFor: (day: string) => Ref.modify(held, (current) => nextHeld(current, day)),
    }
  })
)
