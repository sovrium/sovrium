/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export interface AiActivityLogRow {
  readonly actorType: 'user' | 'agent'
  readonly actorName: string
  readonly action: string
  readonly targetTable?: string | undefined
  readonly userEmail?: string | undefined
}

export class AiActivityLogDatabaseError extends Data.TaggedError('AiActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

export class AiActivityLogRepository extends Context.Tag('AiActivityLogRepository')<
  AiActivityLogRepository,
  {
    readonly append: (row: AiActivityLogRow) => Effect.Effect<void, AiActivityLogDatabaseError>
  }
>() {}
