/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for AI embedding (RAG) operations.
 *
 * Wraps any failure raised while reading or writing the
 * `system.ai_embeddings` table. Knowledge sync treats embedding writes as
 * best-effort — a failure here never blocks server startup — so this error
 * is normally caught and discarded at the call site.
 */
export class AiEmbeddingDatabaseError extends Data.TaggedError('AiEmbeddingDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * A single embedding row to persist into `system.ai_embeddings`.
 *
 * `sourceRef` is the canonical, human-readable provenance string —
 * `table:<table>:<recordId>:<chunkIndex>` for table records,
 * `document:<path>:<chunkIndex>` for documents. `sourceType`/`sourceId`
 * are the structured equivalents used for cleanup queries.
 */
export interface NewEmbedding {
  /** Owning agent, or `null` for global (document) knowledge → SQL NULL. */
  readonly agentName: string | null
  readonly sourceType: string
  readonly sourceId: string
  readonly sourceRef: string
  readonly chunkIndex: number
  readonly content: string
  readonly embedding: ReadonlyArray<number>
  readonly metadata?: Record<string, unknown>
}

/**
 * A similarity-search result row returned by {@link AiEmbeddingRepository.search}.
 */
export interface EmbeddingSearchResult {
  readonly agentName: string | null
  readonly sourceRef: string | null
  readonly content: string
  /** Cosine similarity in `[0, 1]` — `1 - cosine_distance`. */
  readonly similarity: number
}

/**
 * AI Embedding Repository Port.
 *
 * Backs the RAG pipeline ([internal ref] /
 * PER-AGENT-KNOWLEDGE): `system.ai_embeddings` holds one row per embedded
 * text chunk, scoped by `agentName` so each agent's knowledge is isolated.
 *
 * `insertMany` is the primary write primitive. `search` performs a pgvector
 * cosine-similarity nearest-neighbour query, optionally scoped to an agent.
 * `deleteBySourceIdPrefix` removes stale embeddings when a source record or
 * document is removed.
 */
export class AiEmbeddingRepository extends Context.Service<
  AiEmbeddingRepository,
  {
    /** Persist a batch of embeddings. */
    readonly insertMany: (
      rows: ReadonlyArray<NewEmbedding>
    ) => Effect.Effect<void, AiEmbeddingDatabaseError>
    /**
     * Cosine-similarity nearest-neighbour search over the query embedding.
     * Results are filtered by `minSimilarity` and capped at `maxResults`,
     * optionally scoped to a single `agentName`.
     */
    readonly search: (input: {
      readonly embedding: ReadonlyArray<number>
      /**
       * The raw query text. Used only by the opt-in SQLite FTS5 lexical-hybrid
       * acceleration path (`RAG_SQLITE_FTS5=on`) to recover exact-term matches;
       * the dense-cosine and pgvector paths ignore it.
       */
      readonly query?: string
      /** Scope the search to one agent's embeddings; `undefined` searches all. */
      readonly agentName: string | undefined
      readonly minSimilarity: number
      readonly maxResults: number
    }) => Effect.Effect<ReadonlyArray<EmbeddingSearchResult>, AiEmbeddingDatabaseError>
    /**
     * Delete every embedding whose `source_id` starts with the given prefix.
     * Used to clear an agent's knowledge before a rebuild, or to drop the
     * embeddings of a deleted source record.
     */
    readonly deleteBySourceIdPrefix: (
      prefix: string
    ) => Effect.Effect<void, AiEmbeddingDatabaseError>
  }
>()('AiEmbeddingRepository') {}
