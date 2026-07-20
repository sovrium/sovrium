/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Duration, Effect } from 'effect'

export const withBlockTimeout = <A>(
  effect: Effect.Effect<A>,
  zero: A,
  ms: number
): Effect.Effect<A> =>
  Effect.timeoutTo(effect, {
    duration: Duration.millis(ms),
    onSuccess: (value: A): A => value,
    onTimeout: (): A => zero,
  })
