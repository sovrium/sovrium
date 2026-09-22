/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, blob, index, primaryKey } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * AI tables — sqlite-core mirror of `schema/ai.ts`.
 *
 * NOTE — SQLite RAG: the pg-core `ai_embeddings` table has an
 * `embedding vector(1536)` column plus an HNSW approximate-nearest-neighbour
 * index. SQLite has no pgvector equivalent, so the embedding is stored as a
 * raw BLOB (a `Float32Array` serialized to bytes) and cosine similarity is
 * computed in application code instead of by a vector index — see
 * `ai-embedding-repository-live.ts (SQLite impl)`. The HNSW index is omitted (no SQLite
 * equivalent); the BLOB column is nullable so non-embedded rows persist.
 */

/**
 * AI Conversations Table
 *
 * Chat conversation sessions between users and AI agents.
 */
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

/**
 * AI Messages Table
 *
 * Individual messages within AI conversations.
 */
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
    /**
     * Delivery status of the message. `complete` for buffered (non-streaming)
     * turns and fully-streamed responses; `incomplete` when a streamed
     * assistant response was interrupted before the terminal `[DONE]` marker
     *. User messages are always `complete`.
     */
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

/**
 * AI Embeddings Table
 *
 * Vector embeddings for RAG (Retrieval-Augmented Generation).
 *
 * SQLite: the pgvector `embedding` column is mirrored as a nullable
 * BLOB holding the vector serialized as a `Float32Array`; cosine similarity is
 * computed in application code by `ai-embedding-repository-live.ts (SQLite impl)`. The HNSW
 * vector index has no SQLite equivalent and is omitted.
 */
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
    // SQLite RAG: vector serialized as a Float32Array BLOB; cosine
    // similarity is computed in application code — see ai-embedding-repository-live.ts (SQLite impl).
    // `mode: 'buffer'` surfaces the column as raw bytes (NOT JSON-parsed).
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
    // SQLite: no HNSW vector index — cosine similarity is computed app-side.
  ]
)

/**
 * AI Knowledge Sources Table
 *
 * Knowledge base source configurations for RAG.
 * @public Live schema, reached only by drizzle-kit through the string path in
 * `drizzle.config.ts` — a consumer no TypeScript import can express. It has no
 * TS importer because no dialect-branching caller needs the SQLite object yet.
 * Deleting it would drop the table from the next generated SQLite migration.
 */
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

/**
 * AI Field Cache Table
 *
 * Cached AI field computation results to avoid redundant API calls.
 * @public Live schema, reached only by drizzle-kit through the string path in
 * `drizzle.config.ts` — a consumer no TypeScript import can express. It has no
 * TS importer because no dialect-branching caller needs the SQLite object yet.
 * Deleting it would drop the table from the next generated SQLite migration.
 */
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
 * @public Live schema, reached only by drizzle-kit through the string path in
 * `drizzle.config.ts` — a consumer no TypeScript import can express. It has no
 * TS importer because no dialect-branching caller needs the SQLite object yet.
 * Deleting it would drop the table from the next generated SQLite migration.
 */
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

/**
 * AI Compute Status Table — sqlite-core mirror of `schema/ai.ts`
 * `ai_compute_status` ([internal ref] Phase 2, design §3 Option A).
 *
 * The observable refinement signal for AI-compute fields. Keyed by
 * `(app_id, table_name, record_id, field_name)`. Plain columns only — fully
 * portable across dialects.
 */
export const aiComputeStatus = systemTable(
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

// Type inference
