/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, blob, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'


export const aiConversations = systemTable(
  'ai_conversations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id'),
    sessionId: text('session_id'),
    agentName: text('agent_name'),
    title: text('title'),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('ai_conversations_userId_idx').on(table.userId),
    index('ai_conversations_createdAt_idx').on(table.createdAt),
    index('ai_conversations_sessionId_idx').on(table.sessionId),
    index('ai_conversations_agentName_idx').on(table.agentName),
  ]
)

export const aiMessages = systemTable(
  'ai_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    status: text('status').notNull().default('complete'),
    toolCalls: text('tool_calls', { mode: 'json' }),
    tokenCount: integer('token_count'),
    model: text('model'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('ai_messages_conversationId_idx').on(table.conversationId),
    index('ai_messages_createdAt_idx').on(table.createdAt),
  ]
)

export const aiEmbeddings = systemTable(
  'ai_embeddings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    agentName: text('agent_name'),
    sourceRef: text('source_ref'),
    chunkIndex: integer('chunk_index').notNull().default(0),
    content: text('content').notNull(),
    embedding: blob('embedding', { mode: 'buffer' }),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('ai_embeddings_source_idx').on(table.sourceType, table.sourceId),
    index('ai_embeddings_agentName_idx').on(table.agentName),
    index('ai_embeddings_sourceRef_idx').on(table.sourceRef),
  ]
)

export const aiKnowledgeSources = systemTable(
  'ai_knowledge_sources',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    type: text('type').notNull(),
    name: text('name').notNull(),
    config: text('config', { mode: 'json' }).notNull(),
    status: text('status').notNull().default('pending'),
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
    errorMessage: text('error_message'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index('ai_knowledge_sources_type_idx').on(table.type)]
)

export const aiFieldCache = systemTable(
  'ai_field_cache',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    fieldName: text('field_name').notNull(),
    inputHash: text('input_hash').notNull(),
    result: text('result', { mode: 'json' }).notNull(),
    model: text('model'),
    tokenCount: integer('token_count'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('ai_field_cache_table_record_field_idx').on(
      table.tableName,
      table.recordId,
      table.fieldName
    ),
    index('ai_field_cache_inputHash_idx').on(table.inputHash),
  ]
)

export const aiToolCalls = systemTable(
  'ai_tool_calls',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    toolName: text('tool_name').notNull(),
    callerType: text('caller_type').notNull(),
    callerId: text('caller_id').notNull(),
    callerRole: text('caller_role').notNull(),
    input: text('input', { mode: 'json' }),
    output: text('output', { mode: 'json' }),
    errorMessage: text('error_message'),
    errorCode: integer('error_code'),
    latencyMs: integer('latency_ms').notNull(),
    transport: text('transport').notNull(),
    sessionId: text('session_id'),
    requestId: text('request_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('ai_tool_calls_toolName_idx').on(table.toolName),
    index('ai_tool_calls_callerId_idx').on(table.callerId),
    index('ai_tool_calls_callerRole_idx').on(table.callerRole),
    index('ai_tool_calls_createdAt_idx').on(table.createdAt),
    index('ai_tool_calls_sessionId_idx').on(table.sessionId),
    index('ai_tool_calls_errorCode_idx').on(table.errorCode),
  ]
)

export const aiFacts = systemTable(
  'ai_facts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    namespace: text('namespace').notNull(),
    agentName: text('agent_name').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fact: text('fact').notNull(),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('ai_facts_namespace_idx').on(table.namespace),
    index('ai_facts_agentName_idx').on(table.agentName),
    index('ai_facts_userId_idx').on(table.userId),
    index('ai_facts_createdAt_idx').on(table.createdAt),
  ]
)

export const aiActivityLogs = systemTable(
  'ai_activity_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorType: text('actor_type').notNull(),
    actorName: text('actor_name').notNull(),
    action: text('action').notNull(),
    targetTable: text('target_table'),
    userEmail: text('user_email'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('ai_activity_logs_action_idx').on(table.action),
    index('ai_activity_logs_actorType_idx').on(table.actorType),
    index('ai_activity_logs_createdAt_idx').on(table.createdAt),
  ]
)

export const aiComputeStatus = systemTable(
  'ai_compute_status',
  {
    appId: text('app_id').notNull(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    fieldName: text('field_name').notNull(),
    status: text('status').notNull(),
    attempt: integer('attempt').notNull().default(0),
    error: text('error'),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({
      columns: [table.appId, table.tableName, table.recordId, table.fieldName],
    }),
  ]
)

export type AiConversation = typeof aiConversations.$inferSelect
export type NewAiConversation = typeof aiConversations.$inferInsert
export type AiComputeStatus = typeof aiComputeStatus.$inferSelect
export type NewAiComputeStatus = typeof aiComputeStatus.$inferInsert
export type AiMessage = typeof aiMessages.$inferSelect
export type NewAiMessage = typeof aiMessages.$inferInsert
export type AiFact = typeof aiFacts.$inferSelect
export type NewAiFact = typeof aiFacts.$inferInsert
export type AiEmbedding = typeof aiEmbeddings.$inferSelect
export type AiKnowledgeSource = typeof aiKnowledgeSources.$inferSelect
export type AiFieldCacheEntry = typeof aiFieldCache.$inferSelect
export type AiToolCall = typeof aiToolCalls.$inferSelect
export type NewAiToolCall = typeof aiToolCalls.$inferInsert
export type AiActivityLog = typeof aiActivityLogs.$inferSelect
export type NewAiActivityLog = typeof aiActivityLogs.$inferInsert
