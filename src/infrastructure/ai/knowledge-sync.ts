/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sql, type SQL } from 'drizzle-orm'
import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai-embedding-repository'
import { chunkText, resolveChunkSettings, type ChunkSettings } from '@/domain/services/rag-chunking'
import { db } from '@/infrastructure/database'
import { extractRows } from '@/infrastructure/database/sql/sql-utils'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { countRowsBy, embedChunksToRows, RagSyncLayer } from './embed-pipeline'
import type { RagAgent } from './rag-agent-input'
import type { NewEmbedding } from '@/application/ports/repositories/ai-embedding-repository'
import type { AiService } from '@/application/ports/services/ai-service'

interface KnowledgeRecord {
  readonly id: string
  readonly fields: Readonly<Record<string, string>>
}

interface KnowledgeTableEntry {
  readonly table: string
  readonly fields: ReadonlyArray<string>
  readonly filter?: Readonly<Record<string, unknown>>
}

interface AgentKnowledgeInput {
  readonly name: string
  readonly tables: ReadonlyArray<KnowledgeTableEntry>
}

export interface SyncKnowledgeStats {
  readonly tables: Readonly<Record<string, number>>
  readonly totalChunks: number
}

const quoteIdent = (name: string): string => `"${name.replace(/"/g, '""')}"`

const runReadQuery = async (query: SQL): Promise<ReadonlyArray<Record<string, unknown>>> => {
  if (isSqliteRuntime()) {
    const sqliteDb = db as unknown as {
      all: (q: SQL) => ReadonlyArray<Record<string, unknown>>
    }
    return sqliteDb.all(query)
  }
  return extractRows(await db.execute(query))
}

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
    catch: () => [],
  }).pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<KnowledgeRecord>)))

interface PendingChunk {
  readonly table: string
  readonly recordId: string
  readonly chunkIndex: number
  readonly content: string
}

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

const syncAgentKnowledge = (input: {
  readonly agent: AgentKnowledgeInput
  readonly chunkSettings: ChunkSettings
}): Effect.Effect<SyncKnowledgeStats, never, AiService | AiEmbeddingRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository
    const { agent } = input

    yield* repo
      .deleteBySourceIdPrefix(`table-agent:${agent.name}:`)
      .pipe(Effect.catchAll(() => Effect.void))

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
    yield* repo.insertMany(rows).pipe(Effect.catchAll(() => Effect.void))

    const tables = countRowsBy(rows, (row) => String((row.metadata ?? {})['table'] ?? ''))
    return { tables, totalChunks: rows.length } satisfies SyncKnowledgeStats
  })

export const runSyncKnowledge = async (
  agents: ReadonlyArray<AgentKnowledgeInput>
): Promise<Readonly<Record<string, SyncKnowledgeStats>>> => {
  if (agents.length === 0) return {}
  const chunkSettings = resolveChunkSettings(process.env)
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
  await runSyncKnowledge(agents).catch((error: unknown) => {
    console.warn('[ai-rag] knowledge sync failed:', error)
  })
}

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
    yield* repo.deleteBySourceIdPrefix(sourceId).pipe(Effect.catchAll(() => Effect.void))

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
    yield* repo.insertMany(rows).pipe(Effect.catchAll(() => Effect.void))
  }).pipe(Effect.provide(RagSyncLayer))
  await Effect.runPromise(program).catch(() => undefined)
}

export const removeKnowledgeRecordEmbeddings = async (input: {
  readonly agentName: string
  readonly table: string
  readonly recordId: string
}): Promise<void> => {
  const sourceId = `table-agent:${input.agentName}:${input.table}:${input.recordId}`
  const program = Effect.gen(function* () {
    const repo = yield* AiEmbeddingRepository
    yield* repo.deleteBySourceIdPrefix(sourceId).pipe(Effect.catchAll(() => Effect.void))
  }).pipe(Effect.provide(RagSyncLayer))
  await Effect.runPromise(program).catch(() => undefined)
}
