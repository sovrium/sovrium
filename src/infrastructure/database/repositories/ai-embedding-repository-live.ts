/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AiEmbeddingDatabaseError,
  AiEmbeddingRepository,
} from '@/application/ports/repositories/ai-embedding-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { extractRows } from '@/infrastructure/database/sql/sql-utils'
import type {
  EmbeddingSearchResult,
  NewEmbedding,
} from '@/application/ports/repositories/ai-embedding-repository'

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
