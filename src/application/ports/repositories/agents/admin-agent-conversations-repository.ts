/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export class AdminAgentConversationsDatabaseError extends Data.TaggedError(
  'AdminAgentConversationsDatabaseError'
)<{
  readonly cause: unknown
}> {}

export interface AdminAgentConversationRow {
  readonly id: string
  readonly title: string | null
  readonly sessionId: string | null
  readonly messageCount: number
  readonly updatedAt: Date | string
  readonly createdAt: Date | string
}

export interface AdminAgentMessageRow {
  readonly id: string
  readonly role: string
  readonly content: string
  readonly status: string
  readonly model: string | null
  readonly tokenCount: number | null
  readonly toolCalls: unknown
  readonly createdAt: Date | string
}

export interface AdminAgentConversationsListFilters {
  readonly agentName: string
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly cursor?: { readonly value: string; readonly id: string } | undefined
  readonly limit: number
}

export class AdminAgentConversationsRepository extends Context.Tag(
  'AdminAgentConversationsRepository'
)<
  AdminAgentConversationsRepository,
  {
    readonly listConversations: (
      filters: AdminAgentConversationsListFilters
    ) => Effect.Effect<readonly AdminAgentConversationRow[], AdminAgentConversationsDatabaseError>

    readonly getConversation: (
      agentName: string,
      conversationId: string
    ) => Effect.Effect<AdminAgentConversationRow | undefined, AdminAgentConversationsDatabaseError>

    readonly listMessages: (
      conversationId: string
    ) => Effect.Effect<readonly AdminAgentMessageRow[], AdminAgentConversationsDatabaseError>
  }
>() {}
