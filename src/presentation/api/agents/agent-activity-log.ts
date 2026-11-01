/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Agent-action activity log.
 *
 * When an agent executes an action it must appear in
 * activity monitoring with `actor_type = 'agent'` and `actor_name` set to the
 * agent's name. The `system.ai_activity_logs` feed carries this AI-interaction
 * monitoring data; it is distinct from the `system.activity_logs` CRUD audit
 * trail (which records `userId`/`tableName`/`recordId` tuples for
 * human-initiated record changes).
 *
 * Persistence runs through the `recordAiActivity` application use-case, the
 * same one the agent runtime writes each tool step with. Agent actions write
 * `actor_type = 'agent'` rows. All writes are best-effort — a DB failure must
 * never break the agent runtime.
 */

import { Effect } from 'effect'
import { recordAiActivity } from '@/application/use-cases/ai/record-ai-activity'
import { logError } from '@/infrastructure/logging/logger'
import type { AiActivityLogRepository } from '@/application/ports/repositories/ai/ai-activity-log-repository'

/**
 * A single agent-action entry to persist to the `activity_log` table.
 *
 * Named `AgentActivityLogEntry` to distinguish it from `agent-approval-store.ts`'s
 * in-memory `AgentActivityEntry` — the two carry different shapes (DB row
 * vs. `GET /api/activity` feed entry) and previously shared a name.
 */
export interface AgentActivityLogEntry {
  readonly actorName: string
  readonly action: string
  readonly targetTable: string | undefined
  /** The surface that started the agent turn, when the action belongs to one. */
  readonly surface?: 'chat' | 'automation' | 'schedule' | undefined
}

/**
 * Record an agent action in the activity log. Best-effort — any persistence
 * failure is swallowed so the agent runtime is unaffected.
 */
export const recordAgentActivity = (
  entry: AgentActivityLogEntry
): Effect.Effect<void, never, AiActivityLogRepository> =>
  recordAiActivity({
    actorType: 'agent',
    actorName: entry.actorName,
    action: entry.action,
    targetTable: entry.targetTable,
    surface: entry.surface,
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[agents] activity log write failed', cause, { agent: entry.actorName })
      })
    ),
    // effect-swallow: monitoring is best-effort, and a log write must not fail the agent's action.
    Effect.result,
    Effect.asVoid
  )
