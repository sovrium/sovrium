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
import { db } from '@/infrastructure/database'
import { extractRows } from '@/infrastructure/database/sql/sql-utils'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logError } from '@/infrastructure/logging/logger'
import { countRowsBy, embedChunksToRows, RagSyncLayer, swallowLogged } from './embed-pipeline'
import type { RagAgent } from './rag-agent-input'
import type { NewEmbedding } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { AiService } from '@/application/ports/services/ai-service'

/** A record loaded from a knowledge table — `id` plus the requested fields. */
interface KnowledgeRecord {
  readonly id: string
  readonly fields: Readonly<Record<string, string>>
}

/** One table-knowledge entry on an agent. */
interface KnowledgeTableEntry {
  readonly table: string
  readonly fields: ReadonlyArray<string>
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

/**
 * Quote a SQL identifier (table or column name). Knowledge table/field
 * names are already schema-validated against `app.tables`, so this is a
 * defence-in-depth measure, not the primary trust boundary.
 */
const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`

/**
 * Run a portable read query and return the row objects. Postgres uses the
 * bun-sql `db.execute(...)` path (rows array, or `{ rows }` on older drivers);
 * SQLite uses the bun-sqlite `db.all(...)` path, which the PG-typed `db` facade
 * does not expose but the bun-sqlite runtime client does. Centralizing the
 * branch keeps the dialect seam in one place.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Drizzle's native mutable `SQL` shape; wrapping in `Readonly<>` breaks the `db.execute`/`db.all` APIs which require `SQL`. Same rationale as the aggregation-helpers selectors.
const runReadQuery = async (query: SQL): Promise<ReadonlyArray<Record<string, unknown>>> => {
  if (isSqliteRuntime()) {
    // `db.all` exists on the bun-sqlite runtime client; the PG facade type omits
    // it, so reach it through a structural cast at this dialect seam.
    const sqliteDb = db as unknown as {
      // eslint-disable-next-line functional/prefer-immutable-types -- Drizzle's native mutable `SQL` shape; the bun-sqlite `db.all` runtime signature takes `SQL`.
      all: (q: SQL) => ReadonlyArray<Record<string, unknown>>
    }
    return sqliteDb.all(query)
  }
  return extractRows(await db.execute(query))
}

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
 * Load records for one knowledge-table entry. Selects `id` plus each
 * configured field, applying the optional equality filter. Failures resolve
 * to an empty list so a missing/renamed table never aborts the sync.
 */
const loadKnowledgeRecords = (input: {
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter: Readonly<Record<string, unknown>> | undefined
}): Effect.Effect<ReadonlyArray<KnowledgeRecord>, never> =>
  Effect.tryPromise({
    try: async () => {
      const columns = ['id', ...input.fields].map(quoteIdent).join(', ')
      const filterEntries = Object.entries(input.filter ?? {})
      const whereClause =
        filterEntries.length > 0
          ? sql` WHERE ${sql.join(
              filterEntries.map(
                ([key, value]) => sql`${sql.raw(quoteIdent(key))} = ${value as string}`
              ),
              sql` AND `
            )}`
          : sql``
      const rows = await runReadQuery(
        sql`SELECT ${sql.raw(columns)} FROM ${sql.raw(quoteIdent(input.table))}${whereClause}`
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
    // Keep the cause so the tap below can name it. `catch: () => []` discarded
    // it here AND again in the `orElseSucceed`, which is why a renamed table and
    // an empty one used to produce byte-identical behaviour and no log line.
    catch: (cause) => new KnowledgeTableUnreadable({ table: input.table, cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[ai-rag] knowledge table not readable', cause, { table: input.table })
      })
    ),
    Effect.orElseSucceed(() => [] as ReadonlyArray<KnowledgeRecord>)
  )

/** A chunk awaiting embedding, carrying its provenance. */
interface PendingChunk {
  readonly table: string
  readonly recordId: string
  readonly chunkIndex: number
  readonly content: string
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
  metadata: { table: chunk.table, recordId: chunk.recordId },
})

/**
 * Flatten one knowledge-table entry's records into pending chunks: each
 * record's configured text fields are concatenated then chunked.
 */
const recordsToChunks = (
  table: string,
  records: ReadonlyArray<KnowledgeRecord>,
  fields: ReadonlyArray<string>,
  chunkSettings: ChunkSettings
): ReadonlyArray<PendingChunk> =>
  records.flatMap((record) => {
    const text = fields
      .map((field) => record.fields[field] ?? '')
      .filter((value) => value.trim().length > 0)
      .join('\n')
    return chunkText(text, chunkSettings).map((content, chunkIndex) => ({
      table,
      recordId: record.id,
      chunkIndex,
      content,
    }))
  })

/**
 * Embed a single agent's table-knowledge and persist it
 *.
 *
 * Pre-clears the agent's existing embeddings (`source_id` prefixed
 * `table-agent:<agent>:`) so re-running is idempotent — a rebuild replaces
 * rather than duplicates. Each chunk is embedded via the eco-routed
 * `AiService.embed`; a per-chunk provider failure is skipped, never fatal.
 */
const syncAgentKnowledge = (input: {
  readonly agent: AgentKnowledgeInput
  readonly chunkSettings: ChunkSettings
}): Effect.Effect<SyncKnowledgeStats, never, AiService | AiEmbeddingRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository
    const { agent } = input

    yield* repo
      .deleteBySourceIdPrefix(`table-agent:${agent.name}:`)
      .pipe(swallowLogged('agent embeddings not pre-cleared', { agent: agent.name }))

    const pendingGroups = yield* Effect.forEach(agent.tables, (entry) =>
      loadKnowledgeRecords({
        table: entry.table,
        fields: entry.fields,
        filter: entry.filter,
      }).pipe(
        Effect.map((records) =>
          recordsToChunks(entry.table, records, entry.fields, input.chunkSettings)
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

/**
 * Run knowledge sync for a list of agents. Returns per-agent stats.
 * Errors are swallowed — a sync failure must never block server startup.
 */
export const runSyncKnowledge = async (
  agents: ReadonlyArray<AgentKnowledgeInput>
): Promise<Readonly<Record<string, SyncKnowledgeStats>>> => {
  if (agents.length === 0) return {}
  const chunkSettings = resolveChunkSettings(process.env)
  // `syncAgentKnowledge` has a `never` error channel — it swallows its own
  // failures — so no per-agent `catchAll` is needed here.
  const program = Effect.forEach(agents, (agent) =>
    syncAgentKnowledge({ agent, chunkSettings }).pipe(
      Effect.map((stats) => [agent.name, stats] as const)
    )
  ).pipe(Effect.provide(RagSyncLayer))
  const results = await Effect.runPromise(program).catch(
    (): ReadonlyArray<readonly [string, SyncKnowledgeStats]> => []
  )
  return Object.fromEntries(results)
}

/**
 * Startup runner — mirrors `runSyncAgentUsers`. Extracts table-knowledge
 * from `app.agents[]` and syncs it. Best-effort: a failure is logged but
 * never thrown.
 */
export const runSyncKnowledgeAtStartup = async (input: {
  readonly agents: ReadonlyArray<RagAgent> | undefined
}): Promise<void> => {
  const agents = (input.agents ?? [])
    .map((agent): AgentKnowledgeInput => {
      const tableEntries = (agent.knowledge?.tables ?? []).map((t) => ({
        table: t.table,
        fields: t.fields,
        ...(t.filter !== undefined ? { filter: t.filter } : {}),
      }))
      return { name: agent.name, tables: tableEntries }
    })
    .filter((agent) => agent.tables.length > 0)
  if (agents.length === 0) return
  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget background logging (promise result intentionally discarded)
  await runSyncKnowledge(agents).catch((error: unknown) => {
    logError('[ai-rag] knowledge sync failed', error)
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
  readonly filter?: Readonly<Record<string, unknown>>
}> =>
  (agents ?? []).flatMap((agent) =>
    (agent.knowledge?.tables ?? []).map((t) => ({
      agentName: agent.name,
      table: t.table,
      fields: t.fields,
      ...(t.filter !== undefined ? { filter: t.filter } : {}),
    }))
  )

/**
 * Load a single record (by id) from a knowledge table. Returns `undefined`
 * when the record is missing or excluded by the entry's equality filter.
 */
const loadSingleRecord = async (input: {
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter: Readonly<Record<string, unknown>> | undefined
  readonly recordId: string
}): Promise<KnowledgeRecord | undefined> => {
  const records = await Effect.runPromise(
    loadKnowledgeRecords({ table: input.table, fields: input.fields, filter: input.filter })
  ).catch((): ReadonlyArray<KnowledgeRecord> => [])
  return records.find((r) => r.id === input.recordId)
}

/**
 * Re-embed a single knowledge record after an `INSERT`/`UPDATE`
 *. Pre-clears that record's prior embeddings so
 * an update replaces rather than duplicates. When the record no longer
 * matches the entry's filter, its embeddings are simply removed.
 */
export const embedKnowledgeRecord = async (input: {
  readonly agentName: string
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter: Readonly<Record<string, unknown>> | undefined
  readonly recordId: string
}): Promise<void> => {
  const sourceId = `table-agent:${input.agentName}:${input.table}:${input.recordId}`
  const chunkSettings = resolveChunkSettings(process.env)
  const program = Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository
    // Clear the record's prior embeddings (idempotent re-embed).
    yield* repo
      .deleteBySourceIdPrefix(sourceId)
      .pipe(swallowLogged('record embeddings not pre-cleared', { sourceId }))

    // effect-promise: total -- `loadSingleRecord` resolves its query through `Effect.runPromise(...).catch(() => [])`, so an unreadable table yields no record rather than rejecting.
    const record = yield* Effect.promise(() =>
      loadSingleRecord({
        table: input.table,
        fields: input.fields,
        filter: input.filter,
        recordId: input.recordId,
      })
    )
    if (record === undefined) return
    const text = input.fields
      .map((field) => record.fields[field] ?? '')
      .filter((value) => value.trim().length > 0)
      .join('\n')
    const chunks: ReadonlyArray<PendingChunk> = chunkText(text, chunkSettings).map(
      (content, chunkIndex) => ({
        table: input.table,
        recordId: input.recordId,
        chunkIndex,
        content,
      })
    )
    const rows = yield* embedChunksToRows(chunks, (chunk, embedding) =>
      toTableEmbeddingRow(input.agentName, chunk, embedding)
    )
    yield* repo
      .insertMany(rows)
      .pipe(
        swallowLogged('record embeddings not persisted', { sourceId, rows: String(rows.length) })
      )
  }).pipe(Effect.provide(RagSyncLayer))
  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget best-effort embedding
  await Effect.runPromise(program).catch(() => undefined)
}

/**
 * Remove every embedding for a single knowledge record after a `DELETE`
 *.
 */
export const removeKnowledgeRecordEmbeddings = async (input: {
  readonly agentName: string
  readonly table: string
  readonly recordId: string
}): Promise<void> => {
  const sourceId = `table-agent:${input.agentName}:${input.table}:${input.recordId}`
  const program = Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository
    yield* repo
      .deleteBySourceIdPrefix(sourceId)
      .pipe(swallowLogged('record embeddings not removed', { sourceId }))
  }).pipe(Effect.provide(RagSyncLayer))
  // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget best-effort embedding
  await Effect.runPromise(program).catch(() => undefined)
}
