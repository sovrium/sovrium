/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { and, eq, like, sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AiEmbeddingDatabaseError,
  AiEmbeddingRepository,
} from '@/application/ports/repositories/ai-embedding-repository'
import { db } from '@/infrastructure/database'
import { aiEmbeddings as aiEmbeddingsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import {
  cosineSimilarity,
  deserializeEmbedding,
  serializeEmbedding,
} from '@/infrastructure/database/sql/ai-embedding-vector-math'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { extractRows } from '@/infrastructure/database/sql/sql-utils'
import type {
  EmbeddingSearchResult,
  NewEmbedding,
} from '@/application/ports/repositories/ai-embedding-repository'
import type { aiEmbeddings as aiEmbeddingsPg } from '@/infrastructure/database/drizzle/schema/ai'

const wrap = makeDbWrap((cause) => new AiEmbeddingDatabaseError({ cause }))


const EMBEDDING_DIMENSIONS = 1536

const padVector = (embedding: ReadonlyArray<number>): ReadonlyArray<number> => {
  if (embedding.length === EMBEDDING_DIMENSIONS) return embedding
  if (embedding.length > EMBEDDING_DIMENSIONS) {
    return embedding.slice(0, EMBEDDING_DIMENSIONS)
  }
  return [...embedding, ...Array.from({ length: EMBEDDING_DIMENSIONS - embedding.length }, () => 0)]
}

const toVectorLiteral = (embedding: ReadonlyArray<number>): string =>
  `[${padVector(embedding).join(',')}]`

const insertManyImpl = async (rows: ReadonlyArray<NewEmbedding>): Promise<void> => {
  if (rows.length === 0) return
  await Promise.all(
    rows.map((row) => {
      const metadata =
        row.metadata !== undefined ? sql`${JSON.stringify(row.metadata)}::jsonb` : sql`NULL`
      return db.execute(
        sql`
          INSERT INTO system.ai_embeddings
            (source_type, source_id, agent_name, source_ref, chunk_index, content, embedding, metadata)
          VALUES (
            ${row.sourceType}, ${row.sourceId}, ${row.agentName}, ${row.sourceRef},
            ${row.chunkIndex}, ${row.content},
            ${toVectorLiteral(row.embedding)}::vector,
            ${metadata}
          )
        `
      )
    })
  )
}

interface SearchRow {
  readonly agent_name: string | null
  readonly source_ref: string | null
  readonly content: string
  readonly similarity: number
}

const searchImpl = async (input: {
  readonly embedding: ReadonlyArray<number>
  readonly agentName: string | undefined
  readonly minSimilarity: number
  readonly maxResults: number
}): Promise<ReadonlyArray<EmbeddingSearchResult>> => {
  const queryVector = toVectorLiteral(input.embedding)
  const agentFilter =
    input.agentName !== undefined ? sql`AND agent_name = ${input.agentName}` : sql``
  const result = await db.execute(
    sql`
      SELECT
        agent_name,
        source_ref,
        content,
        1 - (embedding <=> ${queryVector}::vector) AS similarity
      FROM system.ai_embeddings
      WHERE embedding IS NOT NULL
        ${agentFilter}
      ORDER BY embedding <=> ${queryVector}::vector
      LIMIT ${input.maxResults}
    `
  )
  const rows = extractRows(result) as unknown as ReadonlyArray<SearchRow>
  return rows
    .map((r) => ({
      agentName: r.agent_name,
      sourceRef: r.source_ref,
      content: r.content,
      similarity: Number(r.similarity),
    }))
    .filter((r) => r.similarity >= input.minSimilarity)
}

const deleteBySourceIdPrefixImpl = async (prefix: string): Promise<void> => {
  await db.execute(sql`DELETE FROM system.ai_embeddings WHERE source_id LIKE ${`${prefix}%`}`)
}

export const AiEmbeddingRepositoryLive = Layer.succeed(
  AiEmbeddingRepository,
  AiEmbeddingRepository.of({
    insertMany: (rows) => wrap(() => insertManyImpl(rows)),
    search: (input) => wrap(() => searchImpl(input)),
    deleteBySourceIdPrefix: (prefix) => wrap(() => deleteBySourceIdPrefixImpl(prefix)),
  })
)


const aiEmbeddingsSqliteTyped = aiEmbeddingsSqlite as unknown as typeof aiEmbeddingsPg

const insertManySqliteImpl = async (rows: ReadonlyArray<NewEmbedding>): Promise<void> => {
  if (rows.length === 0) return
  const values = rows.map((row) => ({
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    agentName: row.agentName,
    sourceRef: row.sourceRef,
    chunkIndex: row.chunkIndex,
    content: row.content,
    embedding: serializeEmbedding(row.embedding) as unknown as ReadonlyArray<number>,
    metadata: row.metadata ?? undefined,
  }))
  await db.insert(aiEmbeddingsSqliteTyped).values(values)
}

interface CandidateRow {
  readonly agentName: string | null
  readonly sourceRef: string | null
  readonly content: string
  readonly embedding: unknown
}

const searchSqliteImpl = async (input: {
  readonly embedding: ReadonlyArray<number>
  readonly agentName: string | undefined
  readonly minSimilarity: number
  readonly maxResults: number
}): Promise<ReadonlyArray<EmbeddingSearchResult>> => {
  const candidates = (await db
    .select({
      agentName: aiEmbeddingsSqliteTyped.agentName,
      sourceRef: aiEmbeddingsSqliteTyped.sourceRef,
      content: aiEmbeddingsSqliteTyped.content,
      embedding: aiEmbeddingsSqliteTyped.embedding,
    })
    .from(aiEmbeddingsSqliteTyped)
    .where(
      input.agentName !== undefined
        ? and(
            sql`${aiEmbeddingsSqliteTyped.embedding} IS NOT NULL`,
            eq(aiEmbeddingsSqliteTyped.agentName, input.agentName)
          )
        : sql`${aiEmbeddingsSqliteTyped.embedding} IS NOT NULL`
    )) as unknown as ReadonlyArray<CandidateRow>

  const scored = candidates
    .map((row) => ({
      agentName: row.agentName,
      sourceRef: row.sourceRef,
      content: row.content,
      similarity: cosineSimilarity(input.embedding, deserializeEmbedding(row.embedding)),
    }))
    .filter((row) => row.similarity >= input.minSimilarity)
  return scored.toSorted((a, b) => b.similarity - a.similarity).slice(0, input.maxResults)
}

const deleteBySourceIdPrefixSqliteImpl = async (prefix: string): Promise<void> => {
  await db
    .delete(aiEmbeddingsSqliteTyped)
    .where(like(aiEmbeddingsSqliteTyped.sourceId, `${prefix}%`))
}

export const AiEmbeddingRepositorySqlite = Layer.succeed(
  AiEmbeddingRepository,
  AiEmbeddingRepository.of({
    insertMany: (rows) => wrap(() => insertManySqliteImpl(rows)),
    search: (input) => wrap(() => searchSqliteImpl(input)),
    deleteBySourceIdPrefix: (prefix) => wrap(() => deleteBySourceIdPrefixSqliteImpl(prefix)),
  })
)
