/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Duration, Effect } from 'effect'
import { recordAutomationRun } from './metrics'

interface RunWithStatus {
  readonly status: string
}

export const traceAutomationRun = <A extends RunWithStatus, E, R>(
  automation: string,
  run: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.timed(run).pipe(
    Effect.tap(([elapsed, result]) =>
      recordAutomationRun(automation, result.status, Duration.toMillis(elapsed) / 1000)
    ),
    Effect.tap(([, result]) => Effect.annotateCurrentSpan('status', result.status)),
    Effect.map(([, result]) => result),
    Effect.withSpan('automation.run', { attributes: { automation } })
  )
