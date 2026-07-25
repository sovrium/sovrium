/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Duration, Effect } from 'effect'
import { recordAiRequest } from './metrics'

export const traceAiRequest = <A, E, R>(
  provider: string,
  model: string,
  operation: string,
  request: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.timed(request).pipe(
    Effect.tap(([elapsed]) =>
      recordAiRequest(provider, model, operation, Duration.toMillis(elapsed) / 1000)
    ),
    Effect.map(([, result]) => result),
    Effect.withSpan('ai.request', { attributes: { provider, model, operation } })
  )
