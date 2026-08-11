/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Application use-case for the AI-interaction activity feed
 *.
 *
 * A thin pass-through over the `AiActivityLogRepository` port — the
 * presentation layer consumes it via `Effect.runPromise`, the infrastructure
 * layer supplies the live Drizzle implementation. No direct database access
 * happens here. The pass-through layer is intentional (see refactor-audit
 * P2.1): it keeps the layer boundary correct and gives future orchestration
 * a hook without the presentation route reaching a repository directly.
 */

import { Effect } from 'effect'
import {
  AiActivityLogRepository,
  type AiActivityLogDatabaseError,
  type AiActivityLogRow,
} from '@/application/ports/repositories/ai/ai-activity-log-repository'

/**
 * Append one row to the AI-interaction activity feed
 * (`system.ai_activity_logs`).
 */
export const recordAiActivity = (
  row: AiActivityLogRow
): Effect.Effect<void, AiActivityLogDatabaseError, AiActivityLogRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiActivityLogRepository
    yield* repo.append(row)
  })
