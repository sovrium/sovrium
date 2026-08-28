/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI embedding repository — two dialect implementations of the
 * `AiEmbeddingRepository` port:
 *
 *   - `AiEmbeddingRepositoryLive`   — Postgres (pgvector `<=>` cosine search).
 * - `AiEmbeddingRepositorySqlite` — SQLite: vectors stored as a
 *     `Float32Array` BLOB, cosine similarity computed in application code.
 *
 * Both return the same `EmbeddingSearchResult` shape and honour the same
 * `minSimilarity` floor + `maxResults` cap (applied AFTER ranking) + optional
 * `agentName` scope, so cross-dialect RAG parity holds. The dialect-gated Layer
 * in `infrastructure/layers/ai-embedding-repository-layer.ts` picks the active
 * implementation.
 */

import { and, eq, like, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AiEmbeddingDatabaseError,
  AiEmbeddingRepository,
} from '@/application/ports/repositories/ai/ai-embedding-repository'
import { db } from '@/infrastructure/database'
import { aiEmbeddings as aiEmbeddingsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import {
  cosineSimilarity,
  deserializeEmbedding,
  serializeEmbedding,
} from '@/infrastructure/database/sql/ai-embedding-vector-math'
import { makeDbWrap, SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import { extractRows } from '@/infrastructure/database/sql/sql-utils'
import { searchSqliteVec } from '@/infrastructure/database/sql/sqlite-vec-search'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type {
  EmbeddingSearchResult,
  NewEmbedding,
} from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { aiEmbeddings as aiEmbeddingsPg } from '@/infrastructure/database/drizzle/schema/ai'

/** Wrap a DB promise, adapting failures to AiEmbeddingDatabaseError. */
const wrap = makeDbWrap((cause) => new AiEmbeddingDatabaseError({ cause }))

// ── Postgres (pgvector) implementation ───────────────────────────────────────

/**
 * Number of dimensions stored in the `system.ai_embeddings.embedding`
 * column (declared `vector(1536)` by migration 0000). Query vectors are
 * padded/truncated to this length so seeded short test vectors (e.g.
 * `[0.1, 0.2, 0.3]`) still write into the fixed-width column.
 */
const EMBEDDING_DIMENSIONS = 1536

/**
 * Normalize an arbitrary-length embedding vector to the fixed column width.
 * Short vectors (the E2E mock seeds 3-element vectors) are zero-padded;
 * over-long vectors are truncated. This keeps the RAG pipeline tolerant of
 * whatever the configured provider returns without a hard dimension check.
 */
const padVector = (embedding: ReadonlyArray<number>): ReadonlyArray<number> => {
  if (embedding.length === EMBEDDING_DIMENSIONS) return embedding
  if (embedding.length > EMBEDDING_DIMENSIONS) {
    return embedding.slice(0, EMBEDDING_DIMENSIONS)
  }
  return [...embedding, ...Array.from({ length: EMBEDDING_DIMENSIONS - embedding.length }, () => 0)]
}

/** Serialize a vector into the pgvector text literal `[v1,v2,...]`. */
const toVectorLiteral = (embedding: ReadonlyArray<number>): string =>
  `[${padVector(embedding).join(',')}]`

/**
 * Insert ONE embedding chunk.
 *
 * Deliberately `db.execute` + a pgvector `::vector` cast rather than the
 * dialect-portable `executeRawTyped`: this implementation is the POSTGRES arm
 * (`AiEmbeddingRepositoryLive`), and pgvector has no SQLite equivalent. The
 * SQLite arm below stores the vector as a `Float32Array` BLOB instead.
 */
const insertEmbeddingRow = (row: Readonly<NewEmbedding>): Promise<unknown> => {
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
}

/**
 * Persist a batch of embeddings, one statement per chunk.
 *
 * FAN-OUT WIDTH: `SHARED_POOL_FANOUT_CONCURRENCY`. Every statement runs on the
 * `db` facade — the SHARED pool — and the width is INPUT-SIZE bounded: one
 * INSERT per embedded chunk, so it grows with the size of the ingested document
 * or table. A single large document can therefore produce a fan-out far wider
 * than the ten default pool slots, which is the mechanism of the 2026-07-25
 * production 504 incident. Knowledge sync is best-effort (every caller pipes
 * `Effect.catch(() => Effect.void)`), but "best-effort" bounds the
 * CONSEQUENCE of a failure, not the CONNECTIONS it holds while succeeding.
 *
 * ORDER: `Effect.all` preserves array order exactly as `Promise.all` did. Row
 * order is not semantically load-bearing here — `chunk_index` carries the
 * ordering — but nothing regresses.
 *
 * ERRORS: no per-row guard before or after, so one failing INSERT fails the
 * whole call and surfaces the identical `AiEmbeddingDatabaseError` with the
 * identical cause. `Effect.all` additionally stops issuing the remaining
 * statements; that only reduces the partial write a failed sync leaves behind,
 * and `deleteBySourceIdPrefix` + re-sync already own that cleanup.
 *
 * An empty `rows` needs no special case — `Effect.all([])` succeeds with `[]`,
 * matching the previous early return.
 *
 * NOT collapsed into a multi-row `INSERT … VALUES (…), (…)`, which the SQLite
 * arm effectively already does via `db.insert(...).values(values)`. There is no
 * `ON CONFLICT` here so no duplicate-key hazard blocks it, but the pgvector text
 * literal makes each row's bind payload large and the batching would need a
 * chunk size chosen against the parameter limit. Worth doing; a separate change
 * from stating a width.
 */
const insertManyEffect = (rows: ReadonlyArray<NewEmbedding>) =>
  Effect.all(
    rows.map((row) => wrap(() => insertEmbeddingRow(row))),
    { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
  ).pipe(Effect.asVoid)

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
  // `db.execute` returns the rows array directly under bun-sql; older
  // drivers wrap it as `{ rows }`. `extractRows` accepts both shapes.
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
  // eslint-disable-next-line functional/no-expression-statements -- prefix delete of stale embeddings
  await db.execute(sql`DELETE FROM system.ai_embeddings WHERE source_id LIKE ${`${prefix}%`}`)
}

/**
 * Live AI embedding repository — Drizzle + bun:sql against
 * `system.ai_embeddings` (pgvector). Mirrors `AiMemoryRepositoryLive`.
 */
export const AiEmbeddingRepositoryLive = Layer.succeed(
  AiEmbeddingRepository,
  AiEmbeddingRepository.of({
    insertMany: (rows) => insertManyEffect(rows),
    search: (input) => wrap(() => searchImpl(input)),
    deleteBySourceIdPrefix: (prefix) => wrap(() => deleteBySourceIdPrefixImpl(prefix)),
  })
)

// ── SQLite (BLOB + app-side cosine) implementation ──────────────────

/**
 * The SQLite `ai_embeddings` table cast to the Postgres-typed shape — the same
 * seam `dialect-schema.ts` uses so the PG-typed `db` facade (`DrizzleDB`)
 * accepts a `sqlite-core` table object. The runtime client is the bun-sqlite
 * driver; this cast is type-only.
 */
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
    // Serialize the vector to a Float32Array BLOB; bun:sqlite binds a
    // Uint8Array as a BLOB literal. The PG-typed `embedding` column expects
    // number[]; the runtime is bun-sqlite, so the BLOB is cast at this seam.
    embedding: serializeEmbedding(row.embedding) as unknown as ReadonlyArray<number>,
    metadata: row.metadata ?? undefined,
  }))
  // eslint-disable-next-line functional/no-expression-statements -- batched embedding insert
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
  readonly query?: string
  readonly agentName: string | undefined
  readonly minSimilarity: number
  readonly maxResults: number
}): Promise<ReadonlyArray<EmbeddingSearchResult>> => {
  // Phase 2 acceleration: when `RAG_SQLITE_VEC=on` and the extension
  // loaded, the sqlite-vec ANN (+ optional FTS5 hybrid) path serves the search
  // with the IDENTICAL response contract. `undefined` means acceleration is off
  // / unavailable → transparently fall back to the Phase 1 app-side cosine scan.
  const accelerated = searchSqliteVec({
    embedding: input.embedding,
    query: input.query ?? '',
    agentName: input.agentName,
    minSimilarity: input.minSimilarity,
    maxResults: input.maxResults,
  })
  if (accelerated !== undefined) return accelerated

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
  // eslint-disable-next-line functional/no-expression-statements -- prefix delete of stale embeddings
  await db
    .delete(aiEmbeddingsSqliteTyped)
    .where(like(aiEmbeddingsSqliteTyped.sourceId, `${prefix}%`))
}

/**
 * SQLite AI embedding repository — Drizzle + bun:sqlite against
 * `system_ai_embeddings`, with vectors stored as Float32Array BLOBs and cosine
 * similarity computed in application code.
 */
export const AiEmbeddingRepositorySqlite = Layer.succeed(
  AiEmbeddingRepository,
  AiEmbeddingRepository.of({
    insertMany: (rows) => wrap(() => insertManySqliteImpl(rows)),
    search: (input) => wrap(() => searchSqliteImpl(input)),
    deleteBySourceIdPrefix: (prefix) => wrap(() => deleteBySourceIdPrefixSqliteImpl(prefix)),
  })
)

/**
 * The active-dialect AI embedding repository.
 *
 * Resolved per process via `isSqliteRuntime()` — the same dispatch `db-bun.ts`
 * uses to build the Drizzle client. EVERY consumer should provide this rather
 * than one of the two implementations above: providing `AiEmbeddingRepositoryLive`
 * directly means pgvector `<=>` SQL on an engine that has no pgvector, and a
 * caller that tolerates search failures turns that into a silent empty result.
 *
 * It lives beside the implementations, not in `infrastructure/layers/`, because
 * the application layer is allowed to name a `*-repository-live` Layer at a
 * composition seam but not an `infrastructure/layers/` module
 * (`APPLICATION_INFRASTRUCTURE_ALLOWLIST` in `[internal ref]`).
 * `infrastructure/layers/ai-embedding-repository-layer.ts` re-exports this, so
 * existing importers are unaffected and there is still exactly one definition.
 */
export const AiEmbeddingRepositoryActive: Layer.Layer<AiEmbeddingRepository> = Layer.suspend(() =>
  isSqliteRuntime() ? AiEmbeddingRepositorySqlite : AiEmbeddingRepositoryLive
)
