/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, count, desc, eq, gte, lt, lte, or, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminAgentConversationsDatabaseError,
  AdminAgentConversationsRepository,
  type AdminAgentConversationRow,
  type AdminAgentMessageRow,
  type AdminAgentConversationsListFilters,
} from '@/application/ports/repositories/agents/admin-agent-conversations-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  aiConversations as aiConversationsPg,
  aiMessages as aiMessagesPg,
} from '@/infrastructure/database/drizzle/schema/ai'
import {
  aiConversations as aiConversationsSqlite,
  aiMessages as aiMessagesSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new AdminAgentConversationsDatabaseError({ cause }))

const aiConversations = resolveDialectSchema(aiConversationsPg, aiConversationsSqlite)
const aiMessages = resolveDialectSchema(aiMessagesPg, aiMessagesSqlite)

const buildDateWindowConditions = (
  filters: AdminAgentConversationsListFilters
): ReadonlyArray<SQL> => {
  const fromCond =
    filters.from !== undefined ? gte(aiConversations.updatedAt, new Date(filters.from)) : undefined
  const toCond =
    filters.to !== undefined ? lte(aiConversations.updatedAt, new Date(filters.to)) : undefined
  return [fromCond, toCond].filter((cond): cond is SQL => cond !== undefined)
}

const buildCursorConditions = (filters: AdminAgentConversationsListFilters): ReadonlyArray<SQL> => {
  if (filters.cursor === undefined) return []
  const { value, id } = filters.cursor
  const sortValue: Readonly<Date> = new Date(value)
  const seek = or(
    lt(aiConversations.updatedAt, sortValue),
    and(eq(aiConversations.updatedAt, sortValue), lt(aiConversations.id, id))
  )
  return seek !== undefined ? [seek] : []
}

const conversationSelect = {
  id: aiConversations.id,
  title: aiConversations.title,
  sessionId: aiConversations.sessionId,
  messageCount: count(aiMessages.id),
  updatedAt: aiConversations.updatedAt,
  createdAt: aiConversations.createdAt,
}

const conversationGroupBy = [
  aiConversations.id,
  aiConversations.title,
  aiConversations.sessionId,
  aiConversations.updatedAt,
  aiConversations.createdAt,
]

const toConversationRow = (row: {
  readonly id: string
  readonly title: string | null
  readonly sessionId: string | null
  readonly messageCount: number
  readonly updatedAt: Date | string
  readonly createdAt: Date | string
}): AdminAgentConversationRow => ({
  id: row.id,
  title: row.title,
  sessionId: row.sessionId,
  messageCount: Number(row.messageCount),
  updatedAt: row.updatedAt,
  createdAt: row.createdAt,
})

const listConversationsImpl = async (
  filters: AdminAgentConversationsListFilters
): Promise<ReadonlyArray<AdminAgentConversationRow>> => {
  const conditions = [
    eq(aiConversations.agentName, filters.agentName),
    ...buildDateWindowConditions(filters),
    ...buildCursorConditions(filters),
  ]

  const rows = await db
    .select(conversationSelect)
    .from(aiConversations)
    .leftJoin(aiMessages, eq(aiMessages.conversationId, aiConversations.id))
    .where(and(...conditions))
    .groupBy(...conversationGroupBy)
    .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
    .limit(filters.limit + 1)

  return rows.map((row) => toConversationRow(row))
}

const getConversationImpl = async (
  agentName: string,
  conversationId: string
): Promise<AdminAgentConversationRow | undefined> => {
  const rows = await db
    .select(conversationSelect)
    .from(aiConversations)
    .leftJoin(aiMessages, eq(aiMessages.conversationId, aiConversations.id))
    .where(and(eq(aiConversations.agentName, agentName), eq(aiConversations.id, conversationId)))
    .groupBy(...conversationGroupBy)
    .limit(1)

  const row = rows[0]
  return row === undefined ? undefined : toConversationRow(row)
}

const listMessagesImpl = async (
  conversationId: string
): Promise<ReadonlyArray<AdminAgentMessageRow>> => {
  const rows = await db
    .select({
      id: aiMessages.id,
      role: aiMessages.role,
      content: aiMessages.content,
      status: aiMessages.status,
      model: aiMessages.model,
      tokenCount: aiMessages.tokenCount,
      toolCalls: aiMessages.toolCalls,
      createdAt: aiMessages.createdAt,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id))

  return rows as ReadonlyArray<AdminAgentMessageRow>
}

export const AdminAgentConversationsRepositoryLive = Layer.succeed(
  AdminAgentConversationsRepository,
  {
    listConversations: (filters) => wrap(async () => listConversationsImpl(filters)),
    getConversation: (agentName, conversationId) =>
      wrap(async () => getConversationImpl(agentName, conversationId)),
    listMessages: (conversationId) => wrap(async () => listMessagesImpl(conversationId)),
  }
)
