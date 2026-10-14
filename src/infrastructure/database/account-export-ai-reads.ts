/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  aiActivityLogs as activityPg,
  aiConversations as conversationsPg,
  aiFacts as factsPg,
  aiMessages as messagesPg,
  aiToolCalls as toolCallsPg,
} from '@/infrastructure/database/drizzle/schema/ai'
import {
  aiActivityLogs as activitySqlite,
  aiConversations as conversationsSqlite,
  aiFacts as factsSqlite,
  aiMessages as messagesSqlite,
  aiToolCalls as toolCallsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import type { AccountAiFootprint } from '@/application/ports/repositories/auth/account-repository'

/**
 * The AI half of the GDPR export: the caller's rows in the four AI tables that
 * erasure hard-deletes, each read with the predicate erasure uses on the same
 * table (`account-purge-steps.ts`, `account-purge-coverage.ts`), so the export
 * lists what erasure removes and nothing more.
 *
 * Every column is named. A row is never spread: `metadata`, a tool call's
 * `input`/`output`/`error_message`, and the caller's own identifiers
 * (`actor_name`, `user_email`, `caller_id`) are not selected, so a column the
 * tables gain later reaches the export only when it is named here. Values are
 * bound by Drizzle; the dialect-correct table objects come from
 * `resolveDialectSchema`, so the reads run on SQLite and PostgreSQL alike.
 */

const conversationsOf = (userId: string) => {
  const conversations = resolveDialectSchema(conversationsPg, conversationsSqlite)
  return db
    .select({
      id: conversations.id,
      sessionId: conversations.sessionId,
      agentName: conversations.agentName,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt), desc(conversations.id))
}

/** Every message of the caller's conversations, oldest first, as a transcript reads. */
const messagesOf = (userId: string) => {
  const conversations = resolveDialectSchema(conversationsPg, conversationsSqlite)
  const messages = resolveDialectSchema(messagesPg, messagesSqlite)
  return db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      role: messages.role,
      content: messages.content,
      status: messages.status,
      model: messages.model,
      toolCalls: messages.toolCalls,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, userId))
    .orderBy(asc(messages.createdAt), asc(messages.id))
}

const factsOf = (userId: string) => {
  const facts = resolveDialectSchema(factsPg, factsSqlite)
  return db
    .select({
      id: facts.id,
      namespace: facts.namespace,
      agentName: facts.agentName,
      fact: facts.fact,
      createdAt: facts.createdAt,
    })
    .from(facts)
    .where(eq(facts.userId, userId))
    .orderBy(desc(facts.createdAt), desc(facts.id))
}

/**
 * The activity entries naming the caller: their own turns (`actor_type =
 * 'user'`, by id or by address), and any entry whose `user_email` is their
 * address, an agent's action done for them included. The actor is projected
 * only when an agent acted; otherwise it is the caller and is left out.
 */
const activityOf = (userId: string, email: string) => {
  const activity = resolveDialectSchema(activityPg, activitySqlite)
  return db
    .select({
      action: activity.action,
      targetTable: activity.targetTable,
      agentName: sql<
        string | null
      >`CASE WHEN ${activity.actorType} = 'agent' THEN ${activity.actorName} ELSE NULL END`,
      surface: activity.surface,
      createdAt: activity.createdAt,
    })
    .from(activity)
    .where(
      or(
        and(eq(activity.actorType, 'user'), inArray(activity.actorName, [userId, email])),
        eq(activity.userEmail, email)
      )
    )
    .orderBy(desc(activity.createdAt), desc(activity.id))
}

/**
 * The tool calls recorded under the caller's user id. A `'token'` caller's tag
 * can equal a user id and is another principal's trail, so it is excluded, as
 * erasure excludes it. Whether the call failed is computed in SQL so the error
 * text, which can quote the record it failed on, is never read.
 */
const toolCallsOf = (userId: string) => {
  const calls = resolveDialectSchema(toolCallsPg, toolCallsSqlite)
  return db
    .select({
      id: calls.id,
      toolName: calls.toolName,
      callerRole: calls.callerRole,
      transport: calls.transport,
      sessionId: calls.sessionId,
      failed: sql<
        boolean | number
      >`CASE WHEN ${calls.errorCode} IS NOT NULL OR ${calls.errorMessage} IS NOT NULL THEN 1 ELSE 0 END`,
      errorCode: calls.errorCode,
      latencyMs: calls.latencyMs,
      createdAt: calls.createdAt,
    })
    .from(calls)
    .where(and(inArray(calls.callerType, ['oauth', 'user']), eq(calls.callerId, userId)))
    .orderBy(desc(calls.createdAt), desc(calls.id))
}

/**
 * Read the caller's whole AI footprint, one query after another: this is a
 * request path on the shared pool, and the export's other reads run in
 * sequence too. Rejects on a database error; the repository wraps it.
 */
export const readAiFootprint = async (
  userId: string,
  email: string
): Promise<AccountAiFootprint> => ({
  conversations: await conversationsOf(userId),
  messages: await messagesOf(userId),
  facts: await factsOf(userId),
  activity: await activityOf(userId, email),
  toolCalls: await toolCallsOf(userId),
})
