/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared embedding-pipeline primitives for the RAG sync runners
 *.
 *
 * Both `knowledge-sync.ts` (table knowledge) and `document-sync.ts` (document
 * knowledge) flatten their source into a list of text chunks, embed each chunk
 * via the eco-routed `AiService`, and persist the resulting rows through the
 * `AiEmbeddingRepository` port. The embed-each-chunk-then-filter-failures step
 * and the layer composition were duplicated three times before this module —
 * `embedChunksToRows` and `RagSyncLayer` are the single source of truth.
 */

import { Effect, Layer } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import { AiEmbeddingRepositoryActive } from '@/infrastructure/layers/ai-embedding-repository-layer'
import { logError } from '@/infrastructure/logging/logger'
import { AiLive } from './layer'
import type {
  AiEmbeddingRepository,
  NewEmbedding,
} from '@/application/ports/repositories/ai/ai-embedding-repository'

/**
 * The merged layer every RAG sync Effect program needs — the eco-routed
 * `AiService` plus the `AiEmbeddingRepository`. Shared by both the
 * table-knowledge and document-knowledge sync runners.
 */
export const RagSyncLayer: Layer.Layer<AiService | AiEmbeddingRepository> = Layer.merge(
  AiLive,
  AiEmbeddingRepositoryActive
)

/**
 * Discard the failure of a best-effort embedding write, after logging its cause.
 *
 * Every `AiEmbeddingRepository` write in the two sync runners is non-fatal by
 * design — RAG indexing must never block a server boot or a record write. What
 * was never intended is that it be *invisible*: six `.pipe(Effect.ignore)`
 * sites meant a dead database and an empty knowledge base produced the same
 * output, and the same exit code, as a successful sync.
 *
 * The tap sits INSIDE this helper's own pipe, ahead of the `ignore`, which is
 * both the correct order (a tap after the swallow observes nothing) and the one
 * `sovrium/no-effect-swallow-without-log` can verify.
 */
export const swallowLogged =
  (label: string, attributes: Readonly<Record<string, string>> = {}) =>
  <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<void, never, R> =>
    program.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError(`[ai-rag] ${label}`, cause, attributes)
        })
      ),
      Effect.ignore
    )

/** A pending chunk carries the text to embed under a `content` field. */
export interface TextChunk {
  readonly content: string
}

/**
 * Embed a list of text chunks into persistable `NewEmbedding` rows.
 *
 * Each chunk's `content` is embedded via `AiService.embed`; `toRow` turns the
 * chunk plus its embedding vector into a `NewEmbedding`. A per-chunk provider
 * failure is skipped (never fatal) so one bad chunk cannot abort a whole sync —
 * the returned array contains only the chunks that embedded successfully.
 */
export const embedChunksToRows = <Chunk extends TextChunk>(
  chunks: ReadonlyArray<Chunk>,
  toRow: (chunk: Chunk, embedding: ReadonlyArray<number>) => NewEmbedding
): Effect.Effect<ReadonlyArray<NewEmbedding>, never, AiService> =>
  Effect.gen(function* () {
    const ai = yield* AiService
    const maybeRows = yield* Effect.forEach(chunks, (chunk) =>
      ai.embed({ text: chunk.content }).pipe(
        Effect.map((reply): NewEmbedding | undefined => toRow(chunk, reply.embedding)),
        // Dropping the chunk is right; dropping it silently is not. An
        // unreachable provider fails EVERY chunk, and without this the sync
        // reports "0 chunks" as though the source were empty.
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            logError('[ai-rag] chunk not embedded', cause, {
              chars: String(chunk.content.length),
            })
          })
        ),
        // A per-chunk provider failure is skipped (never fatal): recover with
        // the `void`/`undefined` outcome so the failed chunk drops out of the
        // `filter` below — one bad chunk never aborts a whole sync.
        Effect.catch(() => Effect.void)
      )
    )
    return maybeRows.filter((row): row is NewEmbedding => row !== undefined)
  })

/**
 * Tally embedded rows into a per-source chunk-count map. `keyOf` projects each
 * row to its grouping key (a table name or a document path) read from the
 * row's `metadata`.
 */
export const countRowsBy = (
  rows: ReadonlyArray<NewEmbedding>,
  keyOf: (row: NewEmbedding) => string
): Readonly<Record<string, number>> =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const key = keyOf(row)
    return { ...acc, [key]: (acc[key] ?? 0) + 1 }
  }, {})
