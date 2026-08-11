/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, integer, index, primaryKey, customType } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * Custom vector column type for pgvector extension.
 * Requires: CREATE EXTENSION IF NOT EXISTS vector;
 */
const vector = (name: string, dimensions: number) =>
  customType<{ data: readonly number[] }>({
    dataType() {
      return `vector(${dimensions})`
    },
  })(name)

/**
 * AI Conversations Table
 *
 * Chat conversation sessions between users and AI agents.
 */
export const aiConversations = systemSchema.table(
  'ai_conversations',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id'),
    sessionId: text('session_id'),
    agentName: text('agent_name'),
    title: text('title'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('ai_conversations_userId_idx').on(table.userId),
    index('ai_conversations_createdAt_idx').on(table.createdAt),
    index('ai_conversations_sessionId_idx').on(table.sessionId),
    index('ai_conversations_agentName_idx').on(table.agentName),
  ]
)

/**
 * AI Messages Table
 *
 * Individual messages within AI conversations.
 */
export const aiMessages = systemSchema.table(
  'ai_messages',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    /**
     * Delivery status of the message. `complete` for buffered (non-streaming)
     * turns and fully-streamed responses; `incomplete` when a streamed
     * assistant response was interrupted before the terminal `[DONE]` marker
     *. User messages are always `complete`.
     */
    status: text('status').notNull().default('complete'),
    toolCalls: jsonb('tool_calls'),
    tokenCount: integer('token_count'),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_messages_conversationId_idx').on(table.conversationId),
    index('ai_messages_createdAt_idx').on(table.createdAt),
  ]
)

/**
 * AI Embeddings Table
 *
 * Vector embeddings for RAG (Retrieval-Augmented Generation).
 * Uses pgvector extension with 1536 dimensions (OpenAI ada-002 default).
 *
 * Dimension can be adjusted per deployment via migration.
 */
export const aiEmbeddings = systemSchema.table(
  'ai_embeddings',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    agentName: text('agent_name'),
    sourceRef: text('source_ref'),
    chunkIndex: integer('chunk_index').notNull().default(0),
    content: text('content').notNull(),
    embedding: vector('embedding', 1536),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_embeddings_source_idx').on(table.sourceType, table.sourceId),
    index('ai_embeddings_agentName_idx').on(table.agentName),
    index('ai_embeddings_sourceRef_idx').on(table.sourceRef),
    // HNSW approximate-nearest-neighbour index for RAG cosine-similarity search.
    // Declared in-schema (not as raw migration SQL) so `db:generate` always
    // re-emits it. Requires the pgvector extension (enabled by runMigrations).
    index('ai_embeddings_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    ),
  ]
)

/**
 * AI Knowledge Sources Table
 *
 * Knowledge base source configurations for RAG.
 */
export const aiKnowledgeSources = systemSchema.table(
  'ai_knowledge_sources',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    type: text('type').notNull(),
    name: text('name').notNull(),
    config: jsonb('config').notNull(),
    status: text('status').notNull().default('pending'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('ai_knowledge_sources_type_idx').on(table.type)]
)

/**
 * AI Field Cache Table
 *
 * Cached AI field computation results to avoid redundant API calls.
 */
export const aiFieldCache = systemSchema.table(
  'ai_field_cache',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    fieldName: text('field_name').notNull(),
    inputHash: text('input_hash').notNull(),
    result: jsonb('result').notNull(),
    model: text('model'),
    tokenCount: integer('token_count'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
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

/**
 * AI Tool Calls Table
 *
 * Audit log of every MCP tool invocation. Written by the MCP server's
 * audit middleware when `MCP_AUDIT_ENABLED=true` (default). Provides the
 * forensic trail for AI-initiated activity, parallel to `activity_logs`
 * for human-initiated record changes.
 *
 * Source of truth for the `system.ai_tool_calls` entry in the
 * `InternalTableRegistry`. Admin role can read this table read-only via the
 * auto-generated `{appName}_system_ai_tool_calls_*` MCP tools (admin internals
 * are observational only — no create/update/delete).
 *
 * Fields:
 * - `toolName`: full prefixed tool name (e.g. `crm_contacts_list`,
 *   `crm_action_archive_record`)
 * - `callerType`: `'token' | 'oauth'` — which MCP_AUTH_STRATEGY produced this call
 * - `callerId`: token tag (for token strategy) or user_id (for oauth strategy)
 * - `callerRole`: the resolved role at invocation time (`admin`, `member`,
 *   `viewer`, or custom role from app.auth)
 * - `input`: tool arguments as received from the JSON-RPC `tools/call`
 * - `output`: tool result (omitted when `errorCode` is set)
 * - `errorMessage` / `errorCode`: JSON-RPC error payload when the call failed
 * - `latencyMs`: total handler latency including any DB / Effect work
 * - `transport`: `'stdio' | 'streamable-http'` — which MCP_TRANSPORT served this call
 * - `sessionId`: optional client session identifier (streamable-http MCP-Session-Id header)
 * - `requestId`: JSON-RPC `id` field, for correlating with client logs
 */
export const aiToolCalls = systemSchema.table(
  'ai_tool_calls',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    toolName: text('tool_name').notNull(),
    callerType: text('caller_type').notNull(),
    callerId: text('caller_id').notNull(),
    callerRole: text('caller_role').notNull(),
    input: jsonb('input'),
    output: jsonb('output'),
    errorMessage: text('error_message'),
    errorCode: integer('error_code'),
    latencyMs: integer('latency_ms').notNull(),
    transport: text('transport').notNull(),
    sessionId: text('session_id'),
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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

/**
 * AI Facts Table
 *
 * Persistent learned facts extracted from agent conversations
 *. Each row is an atomic fact scoped by
 * `namespace` (declared on the agent's `memory.facts.namespace`),
 * `agentName`, and `userId` so facts never leak across namespaces or users.
 *
 * The `maxFacts` cap declared on the agent is enforced FIFO by `created_at`.
 */
export const aiFacts = systemSchema.table(
  'ai_facts',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    namespace: text('namespace').notNull(),
    agentName: text('agent_name').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fact: text('fact').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_facts_namespace_idx').on(table.namespace),
    index('ai_facts_agentName_idx').on(table.agentName),
    index('ai_facts_userId_idx').on(table.userId),
    index('ai_facts_createdAt_idx').on(table.createdAt),
  ]
)

/**
 * AI Activity Logs Table
 *
 * Activity-monitoring feed for AI-initiated interactions, distinct from the
 * `system.activity_logs` CRUD audit trail (which records
 * `userId`/`tableName`/`recordId` tuples for human-initiated record changes).
 *
 * Each row carries a first-class `actorType`/`actorName` dimension so
 * monitoring can attribute an action to either a chat user (`actor_type =
 * 'user'`, written per completed `/api/ai/chat` turn) or a non-human agent
 * (`actor_type = 'agent'`, written when an agent executes an action —
 * [internal ref]).
 *
 * The optional `userEmail` column carries explicit user attribution for
 * chat-driven record mutations.
 */
export const aiActivityLogs = systemSchema.table(
  'ai_activity_logs',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorType: text('actor_type').notNull(),
    actorName: text('actor_name').notNull(),
    action: text('action').notNull(),
    targetTable: text('target_table'),
    userEmail: text('user_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_activity_logs_action_idx').on(table.action),
    index('ai_activity_logs_actorType_idx').on(table.actorType),
    index('ai_activity_logs_createdAt_idx').on(table.createdAt),
  ]
)

/**
 * AI Compute Status Table ([internal ref] Phase 2, design §3 Option A).
 *
 * The observable refinement signal for AI-compute fields. The synchronous
 * baseline is the guaranteed floor; the async worker (`refineAiComputeField`)
 * then calls the real provider and writes a refined value back. This table is
 * the EXPLICIT pending/refined/failed/skipped signal specs poll (never racing
 * on the stored value) and the record-API `_aiCompute` projection reads from.
 *
 * Keyed by `(app_id, table_name, record_id, field_name)` — one row per
 * (record, field) so concurrent refinements never collide. `attempt` bounds
 * idempotency/retry; `error` carries the failure reason for `failed` rows.
 *
 * Cross-dialect portable: only plain columns, no PG-only types.
 */
export const aiComputeStatus = systemSchema.table(
  'ai_compute_status',
  {
    appId: text('app_id').notNull(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    fieldName: text('field_name').notNull(),
    /** 'pending' | 'refined' | 'failed' | 'skipped' */
    status: text('status').notNull(),
    attempt: integer('attempt').notNull().default(0),
    error: text('error'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.appId, table.tableName, table.recordId, table.fieldName],
    }),
  ]
)

// Type inference
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
