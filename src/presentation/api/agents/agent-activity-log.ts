/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Agent-action activity log.
 *
 * [internal ref]: when an agent executes an action it must appear in
 * activity monitoring with `actor_type = 'agent'` and `actor_name` set to the
 * agent's name. The `system.ai_activity_logs` feed carries this AI-interaction
 * monitoring data; it is distinct from the `system.activity_logs` CRUD audit
 * trail (which records `userId`/`tableName`/`recordId` tuples for
 * human-initiated record changes).
 *
 * Persistence runs through the shared `recordActivityLogRow` writer in
 * `ai/chat-activity-log.ts`, which fronts the `recordAiActivity` application
 * use-case. Agent actions write `actor_type = 'agent'` rows. All writes are
 * best-effort — a DB failure must never break the agent runtime.
 */

import { recordActivityLogRow } from '@/presentation/api/ai/chat-activity-log'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/**
 * A single agent-action entry to persist to the `activity_log` table.
 *
 * Named `AgentActivityLogEntry` to distinguish it from `approval-store.ts`'s
 * in-memory `AgentActivityEntry` — the two carry different shapes (DB row
 * vs. `GET /api/activity` feed entry) and previously shared a name.
 */
export interface AgentActivityLogEntry {
  readonly actorName: string
  readonly action: string
  readonly targetTable: string | undefined
}

/**
 * Record an agent action in the activity log. Best-effort — any persistence
 * failure is swallowed so the agent runtime is unaffected.
 */
export const recordAgentActivity = async (
  services: DomainContext,
  entry: AgentActivityLogEntry
): Promise<void> =>
  recordActivityLogRow(services, {
    actorType: 'agent',
    actorName: entry.actorName,
    action: entry.action,
    targetTable: entry.targetTable,
  })
