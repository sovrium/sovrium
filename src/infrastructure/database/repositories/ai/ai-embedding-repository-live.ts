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

import { and, eq, isNull, like, or, sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AiEmbeddingDatabaseError,
  AiEmbeddingRepository,
} from '@/application/ports/repositories/ai/ai-embedding-repository'
import { db } from '@/infrastructure/database'
import { aiEmbeddings as aiEmbeddingsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import {
  chunkFieldsOf,
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

/** The `VALUES` tuple of one embedding chunk. */
const embeddingValuesTuple = (row: Readonly<NewEmbedding>) => {
  const metadata =
    row.metadata !== undefined ? sql`${JSON.stringify(row.metadata)}::jsonb` : sql`NULL`
  return sql`(
    ${row.sourceType}, ${row.sourceId}, ${row.agentName}, ${row.sourceRef},
    ${row.chunkIndex}, ${row.content},
    ${toVectorLiteral(row.embedding)}::vector,
    ${metadata}
  )`
}

/**
 * Insert a batch of embedding chunks in ONE statement, so they become visible
 * together: a record cut into several chunk sequences (one per group of fields
 * sharing a read grant) is never half-indexed to a concurrent search.
 *
 * Deliberately `db.execute` + a pgvector `::vector` cast rather than the
 * dialect-portable `executeRawTyped`: this implementation is the POSTGRES arm
 * (`AiEmbeddingRepositoryLive`), and pgvector has no SQLite equivalent. The
 * SQLite arm below stores the vector as a `Float32Array` BLOB instead.
 */
const insertEmbeddingBatch = (batch: ReadonlyArray<NewEmbedding>): Promise<unknown> =>
  db.execute(
    sql`
      INSERT INTO system.ai_embeddings
        (source_type, source_id, agent_name, source_ref, chunk_index, content, embedding, metadata)
      VALUES ${sql.join(batch.map(embeddingValuesTuple), sql`, `)}
    `
  )

/**
 * Rows per `INSERT`. Eight bound parameters a row keeps a batch far under
 * PostgreSQL's 65 535-parameter limit; the pgvector text literal (a few KB a
 * row at 1 536 dimensions) keeps a statement around a megabyte at most.
 */
const INSERT_BATCH_SIZE = 64

/** Split `rows` into consecutive batches of at most {@link INSERT_BATCH_SIZE}. */
const toInsertBatches = (
  rows: ReadonlyArray<NewEmbedding>
): ReadonlyArray<ReadonlyArray<NewEmbedding>> =>
  Array.from({ length: Math.ceil(rows.length / INSERT_BATCH_SIZE) }, (_, index) =>
    rows.slice(index * INSERT_BATCH_SIZE, (index + 1) * INSERT_BATCH_SIZE)
  )

/**
 * Persist a batch of embeddings, one multi-row statement per
 * {@link INSERT_BATCH_SIZE} chunks.
 *
 * FAN-OUT WIDTH: `SHARED_POOL_FANOUT_CONCURRENCY`. Every statement runs on the
 * `db` facade — the SHARED pool — and the number of statements grows with the
 * size of the ingested document or table. A wide unbounded fan-out against the
 * ten default pool slots was the mechanism of the 2026-07-25 production 504
 * incident. Knowledge sync is best-effort (every caller pipes
 * `Effect.catch(() => Effect.void)`), but "best-effort" bounds the
 * CONSEQUENCE of a failure, not the CONNECTIONS it holds while succeeding.
 *
 * ATOMICITY: the rows of one batch appear together. A single record's chunks
 * fit one batch, so a search never sees some of a record's chunk sequences and
 * not the others.
 *
 * ERRORS: one failing statement fails the whole call and surfaces an
 * `AiEmbeddingDatabaseError`; `Effect.all` stops issuing the remaining
 * statements, and `deleteBySourceIdPrefix` + re-sync own the cleanup.
 *
 * An empty `rows` needs no special case — no batch, `Effect.all([])` succeeds.
 */
const insertManyEffect = (rows: ReadonlyArray<NewEmbedding>) =>
  Effect.forEach(toInsertBatches(rows), (batch) => wrap(() => insertEmbeddingBatch(batch)), {
    concurrency: SHARED_POOL_FANOUT_CONCURRENCY,
  }).pipe(Effect.asVoid)

interface SearchRow {
  readonly agent_name: string | null
  readonly source_ref: string | null
  readonly content: string
  readonly similarity: number
  readonly metadata: unknown
}

/** The `agent_name` predicate of a search: one agent, plus global knowledge on request. */
const agentPredicate = (agentName: string | undefined, includeGlobal: boolean | undefined) => {
  if (agentName === undefined) return sql``
  return includeGlobal === true
    ? sql`AND (agent_name = ${agentName} OR agent_name IS NULL)`
    : sql`AND agent_name = ${agentName}`
}

const searchImpl = async (input: {
  readonly embedding: ReadonlyArray<number>
  readonly agentName: string | undefined
  readonly includeGlobal?: boolean
  readonly minSimilarity: number
  readonly maxResults: number
}): Promise<ReadonlyArray<EmbeddingSearchResult>> => {
  const queryVector = toVectorLiteral(input.embedding)
  const agentFilter = agentPredicate(input.agentName, input.includeGlobal)
  const result = await db.execute(
    sql`
      SELECT
        agent_name,
        source_ref,
        content,
        metadata,
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
      fields: chunkFieldsOf(r.metadata),
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
  readonly metadata: unknown
}

const searchSqliteImpl = async (input: {
  readonly embedding: ReadonlyArray<number>
  readonly query?: string
  readonly agentName: string | undefined
  readonly includeGlobal?: boolean
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
    includeGlobal: input.includeGlobal === true,
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
      metadata: aiEmbeddingsSqliteTyped.metadata,
    })
    .from(aiEmbeddingsSqliteTyped)
    .where(
      input.agentName !== undefined
        ? and(
            sql`${aiEmbeddingsSqliteTyped.embedding} IS NOT NULL`,
            input.includeGlobal === true
              ? or(
                  eq(aiEmbeddingsSqliteTyped.agentName, input.agentName),
                  isNull(aiEmbeddingsSqliteTyped.agentName)
                )
              : eq(aiEmbeddingsSqliteTyped.agentName, input.agentName)
          )
        : sql`${aiEmbeddingsSqliteTyped.embedding} IS NOT NULL`
    )) as unknown as ReadonlyArray<CandidateRow>

  const scored = candidates
    .map((row) => ({
      agentName: row.agentName,
      sourceRef: row.sourceRef,
      content: row.content,
      similarity: cosineSimilarity(input.embedding, deserializeEmbedding(row.embedding)),
      fields: chunkFieldsOf(row.metadata),
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
