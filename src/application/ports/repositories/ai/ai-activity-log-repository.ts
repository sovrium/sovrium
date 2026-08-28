/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * A single row appended to the `system.ai_activity_logs` table.
 *
 * Carries the activity-monitoring feed for AI-initiated interactions —
 * chat-turn rows (`actorType = 'user'`) and agent-action rows
 * (`actorType = 'agent'`). Distinct from the `system.activity_logs` CRUD
 * audit trail.
 */
export interface AiActivityLogRow {
  /** Originating actor kind — `'user'` for chat turns, `'agent'` for agent actions. */
  readonly actorType: 'user' | 'agent'
  /** The acting user's identifier or the agent's name. */
  readonly actorName: string
  /** The action verb (e.g. `ai.chat.message`, `record.create`). */
  readonly action: string
  /** Optional table the action targeted; omitted for actions with no table. */
  readonly targetTable?: string | undefined
  /**
   * Optional acting-user email — explicit attribution for chat-driven record
   * mutations. Omitted for rows where no user email
   * is known (e.g. agent-action rows).
   */
  readonly userEmail?: string | undefined
}

/**
 * Database error for AI activity-log operations.
 */
export class AiActivityLogDatabaseError extends Data.TaggedError('AiActivityLogDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * AI Activity Log Repository Port
 *
 * Persists the AI-interaction monitoring feed to `system.ai_activity_logs`.
 * Implementation lives in the infrastructure layer
 * (`ai-activity-log-repository-live.ts`).
 */
export class AiActivityLogRepository extends Context.Service<
  AiActivityLogRepository,
  {
    /** Append one row to `system.ai_activity_logs`. */
    readonly append: (row: AiActivityLogRow) => Effect.Effect<void, AiActivityLogDatabaseError>
  }
>()('AiActivityLogRepository') {}
