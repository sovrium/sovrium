/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type {
  AccountAiFootprint,
  AccountChatAttachmentRow,
} from '@/application/ports/repositories/auth/account-repository'

/**
 * Pure shaping of the rows the GDPR export reads into the entries of its
 * published contract (`accountExportResponseSchema`): every timestamp becomes
 * ISO 8601, and system columns become dedicated keys. Consumed by the export
 * use case (`use-cases/account.ts`), which assembles and validates the payload.
 */

/**
 * The authored-record shape surfaced in the export payload. `created_at` /
 * `updated_at` / `id` are system columns — they become dedicated payload keys,
 * not part of `fields`.
 */
export interface AuthoredRecord {
  readonly tableSlug: string
  readonly recordId: string
  readonly fields: Record<string, unknown>
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Shape one raw authored-record row into the export contract entry. Splits the
 * system columns (`id`, `created_at`, `updated_at`) out of `fields` and coerces
 * the two timestamps to ISO 8601 — preserved verbatim from the former route.
 */
export function shapeAuthoredRecord(
  tableName: string,
  row: Readonly<Record<string, unknown>>
): AuthoredRecord {
  const recordId = row['id']
  const createdAt = row['created_at']
  const updatedAt = row['updated_at']
  const fields = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at'
    )
  )
  return {
    tableSlug: tableName,
    recordId: String(recordId),
    fields,
    createdAt: new Date(String(createdAt)).toISOString(),
    updatedAt: new Date(String(updatedAt ?? createdAt)).toISOString(),
  }
}

/** Shape one chat attachment row into its export entry: the upload instant as ISO 8601. */
export const shapeChatAttachment = (row: Readonly<AccountChatAttachmentRow>) => ({
  id: row.id,
  name: row.name,
  size: row.size,
  mimeType: row.mimeType,
  sessionId: row.sessionId,
  uploadedAt: new Date(row.uploadedAt).toISOString(),
})

/**
 * An assistant turn's stored tool calls, by reference: the id and the tool's
 * name only. The arguments were written by the model and routinely name the
 * people and rows being looked up, so they never reach the export. Anything
 * that is not a list of named calls is reported as no call.
 */
const toolCallRefs = (stored: unknown) => {
  if (!Array.isArray(stored)) return null
  return stored.flatMap((call: unknown) => {
    if (typeof call !== 'object' || call === null) return []
    const { id, name } = call as { readonly id?: unknown; readonly name?: unknown }
    return typeof id === 'string' && typeof name === 'string' ? [{ id, name }] : []
  })
}

const iso = (value: Readonly<Date> | string | number) => new Date(value.valueOf()).toISOString()

type AiConversationRow = AccountAiFootprint['conversations'][number]
type AiMessageRow = AccountAiFootprint['messages'][number]

/**
 * One conversation with its messages (already oldest first) and the ids of the
 * chat files sent in it, matched on its session. It is stamped with its last
 * message, or with its own update time when it holds none.
 */
const shapeAiConversation = (
  conversation: Readonly<AiConversationRow>,
  messages: readonly AiMessageRow[],
  uploads: readonly AccountChatAttachmentRow[]
) => ({
  id: conversation.id,
  sessionId: conversation.sessionId,
  agentName: conversation.agentName,
  title: conversation.title,
  startedAt: iso(conversation.createdAt),
  lastActivityAt: iso(messages.at(-1)?.createdAt ?? conversation.updatedAt),
  attachmentIds: uploads
    .filter((u) => u.sessionId !== null && u.sessionId === conversation.sessionId)
    .map((u) => u.id),
  messages: messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    status: m.status,
    model: m.model,
    toolCalls: toolCallRefs(m.toolCalls),
    sentAt: iso(m.createdAt),
  })),
})

/** One tool call: what ran and how it ended, never what it carried. */
const shapeAiToolCall = (c: Readonly<AccountAiFootprint['toolCalls'][number]>) => ({
  id: c.id,
  toolName: c.toolName,
  callerRole: c.callerRole,
  transport: c.transport,
  sessionId: c.sessionId,
  outcome: Number(c.failed) === 1 ? ('error' as const) : ('success' as const),
  errorCode: c.errorCode,
  latencyMs: c.latencyMs,
  calledAt: iso(c.createdAt),
})

/** Shape the caller's AI footprint into the export's four AI sections. */
export const shapeAiSections = (
  footprint: Readonly<AccountAiFootprint>,
  uploads: readonly AccountChatAttachmentRow[]
) => ({
  aiConversations: footprint.conversations.map((conversation) =>
    shapeAiConversation(
      conversation,
      footprint.messages.filter((m) => m.conversationId === conversation.id),
      uploads
    )
  ),
  aiFacts: footprint.facts.map((f) => ({
    id: f.id,
    namespace: f.namespace,
    agentName: f.agentName,
    fact: f.fact,
    learnedAt: iso(f.createdAt),
  })),
  aiActivity: footprint.activity.map((a) => ({
    action: a.action,
    targetTable: a.targetTable,
    agentName: a.agentName,
    surface: a.surface,
    occurredAt: iso(a.createdAt),
  })),
  aiToolCalls: footprint.toolCalls.map(shapeAiToolCall),
})
