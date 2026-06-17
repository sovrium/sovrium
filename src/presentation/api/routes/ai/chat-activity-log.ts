/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { recordAiActivity } from '@/application/use-cases/ai/record-ai-activity'
import { provideAiActivityLogRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import type { AiActivityLogRow } from '@/application/ports/repositories/ai/ai-activity-log-repository'

export interface ChatActivityLogEntry {
  readonly action: string
  readonly actorName: string
}

export const recordActivityLogRow = async (row: AiActivityLogRow): Promise<void> =>
  Effect.runPromise(
    recordAiActivity(row).pipe(provideAiActivityLogRepoLive, Effect.either, Effect.asVoid)
  )

export const recordChatActivity = async (entry: ChatActivityLogEntry): Promise<void> =>
  recordActivityLogRow({
    actorType: 'user',
    actorName: entry.actorName,
    action: entry.action,
  })
