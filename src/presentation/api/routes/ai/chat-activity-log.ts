/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Activity logging for the generic `/api/ai/chat` endpoint.
 *
 * Drives [internal ref]: every chat interaction (and any record
 * mutation it triggers) must appear in activity monitoring. Each completed
 * chat turn writes one `system.ai_activity_logs` row with an `ai.chat.*`
 * action so monitoring can attribute the interaction to the originating user.
 *
 * Persistence runs through the `recordAiActivity` application use-case (over
 * the `AiActivityLogRepository` port) — the presentation layer holds no DDL
 * and no raw SQL. Every write is best-effort: a DB failure is swallowed via
 * `Effect.either` so it can never break a chat turn or the agent runtime.
 */

import { Effect } from 'effect'
import { recordAiActivity } from '@/application/use-cases/ai/record-ai-activity'
import { provideAiActivityLogRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import type { AiActivityLogRow } from '@/application/ports/repositories/ai/ai-activity-log-repository'

/** A single chat-interaction entry to persist to `system.ai_activity_logs`. */
export interface ChatActivityLogEntry {
  /** The action verb — always prefixed `ai.chat.` (e.g. `ai.chat.message`). */
  readonly action: string
  /** The acting user's identifier (id or email); `'anonymous'` when absent. */
  readonly actorName: string
}

/**
 * Append one row to `system.ai_activity_logs` via the `recordAiActivity`
 * use-case. Best-effort — any persistence failure is swallowed so the caller
 * (a chat turn or agent action) is never affected.
 *
 * Shared low-level writer used by {@link recordChatActivity},
 * `agents/agent-activity-log.ts`, and the chat-flow routes that record
 * automation / mutation / tool-call rows directly.
 */
export const recordActivityLogRow = async (row: AiActivityLogRow): Promise<void> =>
  Effect.runPromise(
    recordAiActivity(row).pipe(provideAiActivityLogRepoLive, Effect.either, Effect.asVoid)
  )

/**
 * Record a chat interaction in the activity log. Best-effort — a persistence
 * failure is swallowed so the chat turn is unaffected.
 */
export const recordChatActivity = async (entry: ChatActivityLogEntry): Promise<void> =>
  recordActivityLogRow({
    actorType: 'user',
    actorName: entry.actorName,
    action: entry.action,
  })
