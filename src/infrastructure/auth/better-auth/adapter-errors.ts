/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { withCauseInMessage } from '@/infrastructure/errors/with-cause-in-message'
import type { drizzleAdapter } from 'better-auth/adapters/drizzle'

type AuthAdapterFactory = ReturnType<typeof drizzleAdapter>

/**
 * Wrap a Better Auth adapter factory so every rejected adapter call carries the
 * driver's message. See {@link withCauseInMessage} for why this is load-bearing.
 *
 * A `Proxy` rather than an explicit method-by-method wrapper: Better Auth's
 * `DBAdapter` surface (`create`, `findOne`, `findMany`, `update`, `updateMany`,
 * `delete`, `deleteMany`, `count`, `transaction`, …) grows across releases, and
 * an enumerated list would silently stop covering a newly added method — losing
 * the message again for exactly the paths nobody thought about.
 */
export const withDriverErrorMessages =
  (factory: AuthAdapterFactory): AuthAdapterFactory =>
  (options) => {
    const adapter = factory(options)
    return new Proxy(adapter, {
      get(target, property, receiver): unknown {
        const value: unknown = Reflect.get(target, property, receiver)
        if (typeof value !== 'function') return value
        return (...args: readonly unknown[]): unknown => {
          const outcome: unknown = (value as (...a: readonly unknown[]) => unknown).apply(target, [
            ...args,
          ])
          return outcome instanceof Promise
            ? outcome.catch((error: unknown) => {
                // eslint-disable-next-line functional/no-throw-statements -- re-raise the same error with its message restored; a transparent pass-through
                throw withCauseInMessage(error)
              })
            : outcome
        }
      },
    })
  }
