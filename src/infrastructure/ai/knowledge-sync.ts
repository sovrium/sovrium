/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Knowledge sync runner — embeds agent table-knowledge into
 * `system.ai_embeddings` at server startup.
 *
 * Mirrors `runSyncAgentUsers` in `agent-user-sync.ts` and `AiComputeListener`:
 * a best-effort startup task that never blocks the server. It bridges the
 * Drizzle-backed user tables to the eco-routed `AiService` port (R3 — the
 * provider is whatever `ECO_AI_PROVIDER_PRECEDENCE` resolves to) via
 * parameterised `SELECT`s + the `AiEmbeddingRepository` port. Pure text
 * chunking lives in the domain layer (`rag-chunking`).
 */

import { sql, type SQL } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import {
  chunkText,
  resolveChunkSettings,
  type ChunkSettings,
} from '@/domain/models/app/agents/rag-chunking'
import { INTRINSIC_DELETED_AT_COLUMN } from '@/domain/models/app/tables/system-fields'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { bestEffort } from '@/infrastructure/logging/best-effort'
import { logError } from '@/infrastructure/logging/logger'
import { countRowsBy, embedChunksToRows, ragSyncLayerOver, swallowLogged } from './embed-pipeline'
import type { RagSyncServices } from './embed-pipeline'
import type { RagAgent } from './rag-agent-input'
import type { NewEmbedding } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { AiService } from '@/application/ports/services/ai-service'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/** A record loaded from a knowledge table — `id` plus the requested fields. */
interface KnowledgeRecord {
  readonly id: string
  readonly fields: Readonly<Record<string, string>>
}

/** One table-knowledge entry on an agent. */
interface KnowledgeTableEntry {
  readonly table: string
  readonly fields: ReadonlyArray<string>
  /** `fields` partitioned by effective read grant; absent = one group. */
  readonly fieldGroups?: ReadonlyArray<ReadonlyArray<string>>
  readonly filter?: Readonly<Record<string, unknown>>
}

/** An agent's table-knowledge configuration. */
interface AgentKnowledgeInput {
  readonly name: string
  readonly tables: ReadonlyArray<KnowledgeTableEntry>
}

/** Per-table chunk counts produced by a sync run. */
export interface SyncKnowledgeStats {
  readonly tables: Readonly<Record<string, number>>
  readonly totalChunks: number
}

/** The row objects a read query answers. */
type Rows = ReadonlyArray<Record<string, unknown>>

/** Run a read query on whichever engine holds the table. */
const runReadQuery = ({ client, dialect }: DatabaseService, query: SQL): Promise<Rows> =>
  executeRawOn(dialect.kind, client, query)

/**
 * A knowledge table that could not be read — most often renamed or dropped out
 * from under an agent's `knowledge:` binding. Non-fatal by design (the sync
 * continues with no records for that table), which is exactly why it needs a
 * name: an anonymous `unknown` in the error channel is how the two cases became
 * indistinguishable in the first place.
 */
class KnowledgeTableUnreadable extends Data.TaggedError('KnowledgeTableUnreadable')<{
  readonly table: string
  readonly cause: unknown
}> {}

/**
 * Load the live records for one knowledge-table entry. Selects `id` plus each
 * configured field, applying the optional equality filter. Failures resolve
 * to an empty list so a missing/renamed table never aborts the sync.
 */
const loadKnowledgeRecords = (input: {
  readonly database: DatabaseService
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter: Readonly<Record<string, unknown>> | undefined
}): Effect.Effect<ReadonlyArray<KnowledgeRecord>, never> =>
  Effect.tryPromise({
    try: async () => {
      const columns = sql.join(
        ['id', ...input.fields].map((column) => sql.identifier(column)),
        sql`, `
      )
      const filterEntries = Object.entries(input.filter ?? {})
      // Live rows only: a row in the trash is out of the index, as it is out
      // of the records API's lists. A soft delete re-embeds through the
      // update path, which then finds no row and leaves its chunks cleared.
      const whereClause = sql` WHERE ${sql.join(
        [
          sql`${sql.identifier(INTRINSIC_DELETED_AT_COLUMN)} IS NULL`,
          ...filterEntries.map(([key, value]) => sql`${sql.identifier(key)} = ${value as string}`),
        ],
        sql` AND `
      )}`
      const rows = await runReadQuery(
        input.database,
        // The table by its DATABASE name: `Help Articles` is stored as
        // `help_articles`, and `"Help Articles"` is a relation nobody created.
        sql`SELECT ${columns} FROM ${tableIdentifier(input.table)}${whereClause}`
      )
      return rows.map((row): KnowledgeRecord => {
        const fields = Object.fromEntries(
          input.fields.map((field) => {
            const value = row[field]
            return [field, value === null || value === undefined ? '' : String(value)] as const
          })
        )
        return { id: String(row['id']), fields }
      })
    },
    // Keep the cause so the tap below can name it. A `catch: () => []` here (and
    // again in the `orElseSucceed`) would discard it, so a renamed table and an
    // empty one would behave byte-identically with no log line.
    catch: (cause) => new KnowledgeTableUnreadable({ table: input.table, cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[ai-rag] knowledge table not readable', cause, { table: input.table })
      })
    ),
    Effect.orElseSucceed(() => [] as ReadonlyArray<KnowledgeRecord>)
  )

/**
 * A chunk awaiting embedding, carrying its provenance: the row it was cut
 * from and the names of the fields whose values it holds. The field names are
 * what a search judges the chunk by — a searcher is served it only when she
 * may read every one of them.
 */
interface PendingChunk {
  readonly table: string
  readonly recordId: string
  readonly chunkIndex: number
  readonly content: string
  readonly fields: ReadonlyArray<string>
}

/**
 * Build the `NewEmbedding` row for one embedded table-knowledge chunk.
 * Shared by the full-agent sync and the per-record re-embed paths.
 */
const toTableEmbeddingRow = (
  agentName: string,
  chunk: PendingChunk,
  embedding: ReadonlyArray<number>
): NewEmbedding => ({
  agentName,
  sourceType: 'table',
  sourceId: `table-agent:${agentName}:${chunk.table}:${chunk.recordId}`,
  sourceRef: `table:${chunk.table}:${chunk.recordId}:${chunk.chunkIndex}`,
  chunkIndex: chunk.chunkIndex,
  content: chunk.content,
  embedding,
  metadata: { table: chunk.table, recordId: chunk.recordId, fields: chunk.fields },
})

/**
 * Cut one record into pending chunks, one chunk sequence per field group: the
 * non-empty values of a group's fields are joined, chunked, and each chunk
 * records the group's field names. A group with no value yields no chunk.
 * Chunk indexes run on across the groups, so every chunk of the record keeps a
 * distinct `sourceRef`.
 */
const recordToChunks = (
  table: string,
  record: KnowledgeRecord,
  fieldGroups: ReadonlyArray<ReadonlyArray<string>>,
  chunkSettings: ChunkSettings
): ReadonlyArray<PendingChunk> =>
  fieldGroups
    .map((fields) => ({
      fields,
      contents: chunkText(
        fields
          .map((field) => record.fields[field] ?? '')
          .filter((value) => value.trim().length > 0)
          .join('\n'),
        chunkSettings
      ),
    }))
    .flatMap(({ fields, contents }) => contents.map((content) => ({ fields, content })))
    .map(({ fields, content }, chunkIndex) => ({
      table,
      recordId: record.id,
      chunkIndex,
      content,
      fields,
    }))

/** The field groups of an entry: its partition, or one group of every field. */
const fieldGroupsOf = (entry: {
  readonly fields: ReadonlyArray<string>
  readonly fieldGroups?: ReadonlyArray<ReadonlyArray<string>> | undefined
}): ReadonlyArray<ReadonlyArray<string>> => entry.fieldGroups ?? [entry.fields]

/**
 * Embed a single agent's table-knowledge and persist it
 * (the AI RAG table knowledge requirement / PER-AGENT-KNOWLEDGE).
 *
 * Pre-clears the agent's existing embeddings (`source_id` prefixed
 * `table-agent:<agent>:`) so re-running is idempotent — a rebuild replaces
 * rather than duplicates. Each chunk is embedded via the eco-routed
 * `AiService.embed`; a per-chunk provider failure is skipped, never fatal.
 */
const syncAgentKnowledge = (input: {
  readonly agent: AgentKnowledgeInput
  readonly chunkSettings: ChunkSettings
}): Effect.Effect<SyncKnowledgeStats, never, AiService | AiEmbeddingRepository | Database> =>
  Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository
    const { agent } = input

    yield* repo
      .deleteBySourceIdPrefix(`table-agent:${agent.name}:`)
      .pipe(swallowLogged('agent embeddings not pre-cleared', { agent: agent.name }))

    const database = yield* Database
    const pendingGroups = yield* Effect.forEach(agent.tables, (entry) =>
      loadKnowledgeRecords({
        database,
        table: entry.table,
        fields: entry.fields,
        filter: entry.filter,
      }).pipe(
        Effect.map((records) =>
          records.flatMap((record) =>
            recordToChunks(entry.table, record, fieldGroupsOf(entry), input.chunkSettings)
          )
        )
      )
    )
    const pending = pendingGroups.flat()

    const rows = yield* embedChunksToRows(pending, (chunk, embedding) =>
      toTableEmbeddingRow(agent.name, chunk, embedding)
    )
    yield* repo.insertMany(rows).pipe(
      swallowLogged('agent embeddings not persisted', {
        agent: agent.name,
        rows: String(rows.length),
      })
    )

    const tables = countRowsBy(rows, (row) => String((row.metadata ?? {})['table'] ?? ''))
    return { tables, totalChunks: rows.length } satisfies SyncKnowledgeStats
  })

/** Sync a list of agents; per-agent stats. Failures are swallowed: they never block the boot. */
export const runSyncKnowledge = async (
  agents: ReadonlyArray<AgentKnowledgeInput>,
  database: DatabaseService
): Promise<Readonly<Record<string, SyncKnowledgeStats>>> => {
  if (agents.length === 0) return {}
  const chunkSettings = resolveChunkSettings(process.env)
  // `syncAgentKnowledge` swallows its own failures: no per-agent `catchAll` here.
  const program = Effect.forEach(agents, (agent) =>
    syncAgentKnowledge({ agent, chunkSettings }).pipe(
      Effect.map((stats) => [agent.name, stats] as const)
    )
  ).pipe(Effect.provide(ragSyncLayerOver(database)))
  const aborted = bestEffort('[ai-rag] knowledge sync aborted', { agents: String(agents.length) })
  const results = await aborted.promise(Effect.runPromise(program), [])
  return Object.fromEntries(results)
}

/**
 * Startup runner — mirrors `runSyncAgentUsers`. Syncs the table-knowledge of
 * `app.agents[]` and returns the per-agent stats; a failure is logged, never thrown.
 */
export const runSyncKnowledgeAtStartup = async (input: {
  readonly agents: ReadonlyArray<RagAgent> | undefined
  readonly database: DatabaseService
}): Promise<Readonly<Record<string, SyncKnowledgeStats>>> => {
  const agents = (input.agents ?? [])
    .map((agent): AgentKnowledgeInput => {
      const tableEntries = (agent.knowledge?.tables ?? []).map((t) => ({
        table: t.table,
        fields: t.fields,
        ...(t.fieldGroups !== undefined ? { fieldGroups: t.fieldGroups } : {}),
        ...(t.filter !== undefined ? { filter: t.filter } : {}),
      }))
      return { name: agent.name, tables: tableEntries }
    })
    .filter((agent) => agent.tables.length > 0)
  if (agents.length === 0) return {}
  return runSyncKnowledge(agents, input.database).catch((error: unknown) => {
    logError('[ai-rag] knowledge sync failed', error)
    return {}
  })
}

/**
 * Build per-table change-tracking bindings from `app.agents[]` — one binding
 * per `(agent, knowledge table)` pair. Consumed by `AiKnowledgeListener` to
 * auto-embed records inserted/updated/deleted after startup.
 */
export const buildKnowledgeBindings = (
  agents: ReadonlyArray<RagAgent> | undefined
): ReadonlyArray<{
  readonly agentName: string
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly fieldGroups?: ReadonlyArray<ReadonlyArray<string>>
  readonly filter?: Readonly<Record<string, unknown>>
}> =>
  (agents ?? []).flatMap((agent) =>
    (agent.knowledge?.tables ?? []).map((t) => ({
      agentName: agent.name,
      table: t.table,
      fields: t.fields,
      ...(t.fieldGroups !== undefined ? { fieldGroups: t.fieldGroups } : {}),
      ...(t.filter !== undefined ? { filter: t.filter } : {}),
    }))
  )

/**
 * Load one record (by id) from a knowledge table; `undefined` when it is missing,
 * filtered out, or its table unreadable (logged, never thrown at the write).
 */
const loadSingleRecord = (input: {
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter: Readonly<Record<string, unknown>> | undefined
  readonly recordId: string
}): Effect.Effect<KnowledgeRecord | undefined, never, Database> => {
  const unread = bestEffort('[ai-rag] knowledge record not read', { table: input.table })
  return unread
    .effect<ReadonlyArray<KnowledgeRecord>>([])(
      Effect.flatMap(Database, (database) => loadKnowledgeRecords({ ...input, database }))
    )
    .pipe(Effect.map((records) => records.find((r) => r.id === input.recordId)))
}

/**
 * Re-embed a single knowledge record after an `INSERT`/`UPDATE`, pre-clearing its
 * prior embeddings so an update replaces rather than duplicates. When the record
 * no longer matches the entry's filter, its embeddings are simply removed. A
 * failure is logged and never fails the record write that triggered it.
 */
export const embedKnowledgeRecord = async (input: {
  readonly agentName: string
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly fieldGroups?: ReadonlyArray<ReadonlyArray<string>> | undefined
  readonly filter: Readonly<Record<string, unknown>> | undefined
  readonly recordId: string
  readonly rag: RagSyncServices
}): Promise<void> => {
  const sourceId = `table-agent:${input.agentName}:${input.table}:${input.recordId}`
  const chunkSettings = resolveChunkSettings(process.env)
  const program = Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository
    // Clear the record's prior embeddings (idempotent re-embed).
    yield* repo
      .deleteBySourceIdPrefix(sourceId)
      .pipe(swallowLogged('record embeddings not pre-cleared', { sourceId }))

    // An unreadable table yields no record: `loadSingleRecord` never fails.
    const record = yield* loadSingleRecord(input)
    if (record === undefined) return
    const chunks = recordToChunks(input.table, record, fieldGroupsOf(input), chunkSettings)
    const rows = yield* embedChunksToRows(chunks, (chunk, embedding) =>
      toTableEmbeddingRow(input.agentName, chunk, embedding)
    )
    yield* repo
      .insertMany(rows)
      .pipe(
        swallowLogged('record embeddings not persisted', { sourceId, rows: String(rows.length) })
      )
  }).pipe(Effect.provide(input.rag))
  // The Promise boundary of a pg notification handler; the services are built.
  await bestEffort('[ai-rag] re-embed aborted', { sourceId }).promise(Effect.runPromise(program))
}

/**
 * Remove a knowledge record's embeddings after a `DELETE`; a failure is only logged.
 */
export const removeKnowledgeRecordEmbeddings = async (input: {
  readonly agentName: string
  readonly table: string
  readonly recordId: string
  readonly rag: RagSyncServices
}): Promise<void> => {
  const sourceId = `table-agent:${input.agentName}:${input.table}:${input.recordId}`
  const program = Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository
    yield* repo
      .deleteBySourceIdPrefix(sourceId)
      .pipe(swallowLogged('record embeddings not removed', { sourceId }))
  }).pipe(Effect.provide(input.rag))
  await bestEffort('[ai-rag] removal aborted', { sourceId }).promise(Effect.runPromise(program))
}
