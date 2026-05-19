/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class RealtimeError extends Data.TaggedError('RealtimeError')<{
  readonly cause: unknown
}> {}

export class RealtimeService extends Context.Tag('RealtimeService')<
  RealtimeService,
  {
    readonly subscribe: (
      channel: string,
      callback: (event: Record<string, unknown>) => void
    ) => Effect.Effect<void, RealtimeError>
    readonly unsubscribe: (channel: string) => Effect.Effect<void, RealtimeError>
    readonly broadcast: (
      channel: string,
      event: string,
      data: Record<string, unknown>
    ) => Effect.Effect<void, RealtimeError>
    readonly getPresence: (
      channel: string
    ) => Effect.Effect<readonly Record<string, unknown>[], RealtimeError>
  }
>() {}
