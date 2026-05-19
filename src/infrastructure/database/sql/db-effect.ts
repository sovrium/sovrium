/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'

export const dbEffect = <A, E>(
  toError: (cause: unknown) => E,
  run: () => Promise<A>
): Effect.Effect<A, E> => Effect.tryPromise({ try: run, catch: toError })

export const makeDbWrap =
  <E>(toError: (cause: unknown) => E) =>
  <A>(run: () => Promise<A>): Effect.Effect<A, E> =>
    dbEffect(toError, run)
