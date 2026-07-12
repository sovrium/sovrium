/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  AdminAgentConversationsRepository,
  type AdminAgentConversationRow,
  type AdminAgentMessageRow,
  type AdminAgentConversationsDatabaseError,
} from '@/application/ports/repositories/agents/admin-agent-conversations-repository'
import {
  agentConversationsListResponseSchema,
  agentConversationDetailResponseSchema,
  type AgentConversationListItem,
  type AgentConversationMessage,
  type AgentConversationHeader,
} from '@/domain/models/api/admin/agents/conversations'
import { AdminAgentConversationsRepositoryLive } from '@/infrastructure/database/repositories/agents/admin-agent-conversations-repository-live'



function toIso(raw: Readonly<Date> | string): string {
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

function buildConversationItem(
  row: AdminAgentConversationRow
): AgentConversationListItem {
  return {
    id: row.id,
    title: row.title,
    sessionId: row.sessionId,
    messageCount: row.messageCount,
    lastActivityAt: toIso(row.updatedAt),
    createdAt: toIso(row.createdAt),
  }
}

function buildConversationHeader(
  row: AdminAgentConversationRow
): AgentConversationHeader {
  return {
    id: row.id,
    title: row.title,
    sessionId: row.sessionId,
    createdAt: toIso(row.createdAt),
    lastActivityAt: toIso(row.updatedAt),
  }
}

function buildMessage(
  row: AdminAgentMessageRow
): AgentConversationMessage {
  return {
    id: row.id,
    role: row.role as AgentConversationMessage['role'],
    content: row.content,
    status: row.status as AgentConversationMessage['status'],
    model: row.model,
    tokenCount: row.tokenCount,
    toolCalls: row.toolCalls ?? null,
    createdAt: toIso(row.createdAt),
  }
}


export function encodeConversationsCursor(value: string, id: string): string {
  return Buffer.from(JSON.stringify({ value, id }), 'utf8').toString('base64')
}

export function decodeConversationsCursor(
  cursor: string
): { readonly value: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly value?: unknown
      readonly id?: unknown
    }
    if (typeof decoded.value !== 'string' || typeof decoded.id !== 'string') return null
    return { value: decoded.value, id: decoded.id }
  } catch {
    return null
  }
}


export interface AgentConversationsListInput {
  readonly agentName: string
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly cursor?: string | undefined
  readonly limit: number
}

export type AgentConversationsListOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly items: readonly AgentConversationListItem[]
        readonly nextCursor: string | null
      }
    }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export const BuildAgentConversations = (
  input: AgentConversationsListInput
): Effect.Effect<
  AgentConversationsListOutcome,
  AdminAgentConversationsDatabaseError,
  AdminAgentConversationsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminAgentConversationsRepository

    const decoded = input.cursor ? decodeConversationsCursor(input.cursor) : null

    const rows = yield* repo.listConversations({
      agentName: input.agentName,
      ...(input.from !== undefined ? { from: input.from } : {}),
      ...(input.to !== undefined ? { to: input.to } : {}),
      ...(decoded !== null ? { cursor: decoded } : {}),
      limit: input.limit,
    })

    const pageRows = rows.slice(0, input.limit)
    const items = pageRows.map((row) => buildConversationItem(row))
    const lastItem = items[items.length - 1]
    const nextCursor =
      rows.length > input.limit && lastItem !== undefined
        ? encodeConversationsCursor(lastItem.lastActivityAt, lastItem.id)
        : null

    const body = { items, nextCursor }
    const parsed = agentConversationsListResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: { items: parsed.data.items, nextCursor: parsed.data.nextCursor },
    }
  })


export type AgentConversationDetailOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly conversation: AgentConversationHeader
        readonly messages: readonly AgentConversationMessage[]
      }
    }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export const BuildAgentConversationDetail = (
  agentName: string,
  conversationId: string
): Effect.Effect<
  AgentConversationDetailOutcome,
  AdminAgentConversationsDatabaseError,
  AdminAgentConversationsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminAgentConversationsRepository

    const conversationRow = yield* repo.getConversation(agentName, conversationId)
    if (conversationRow === undefined) {
      return { _tag: 'NotFound' } as const
    }

    const messageRows = yield* repo.listMessages(conversationId)
    const body = {
      conversation: buildConversationHeader(conversationRow),
      messages: messageRows.map((row) => buildMessage(row)),
    }

    const parsed = agentConversationDetailResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: { conversation: parsed.data.conversation, messages: parsed.data.messages },
    }
  })


export const AdminAgentConversationsLayer = Layer.mergeAll(AdminAgentConversationsRepositoryLive)
