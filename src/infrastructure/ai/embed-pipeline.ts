/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import { AiEmbeddingRepositoryLive } from '@/infrastructure/database/repositories/ai-embedding-repository-live'
import { AiLive } from './layer'
import type {
  AiEmbeddingRepository,
  NewEmbedding,
} from '@/application/ports/repositories/ai-embedding-repository'

export const RagSyncLayer: Layer.Layer<AiService | AiEmbeddingRepository> = Layer.merge(
  AiLive,
  AiEmbeddingRepositoryLive
)

export interface TextChunk {
  readonly content: string
}

export const embedChunksToRows = <Chunk extends TextChunk>(
  chunks: ReadonlyArray<Chunk>,
  toRow: (chunk: Chunk, embedding: ReadonlyArray<number>) => NewEmbedding
): Effect.Effect<ReadonlyArray<NewEmbedding>, never, AiService> =>
  Effect.gen(function* () {
    const ai = yield* AiService
    const maybeRows = yield* Effect.forEach(chunks, (chunk) =>
      ai.embed({ text: chunk.content }).pipe(
        Effect.map((reply): NewEmbedding | undefined => toRow(chunk, reply.embedding)),
        Effect.catchAll(() => Effect.void)
      )
    )
    return maybeRows.filter((row): row is NewEmbedding => row !== undefined)
  })

export const countRowsBy = (
  rows: ReadonlyArray<NewEmbedding>,
  keyOf: (row: NewEmbedding) => string
): Readonly<Record<string, number>> =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const key = keyOf(row)
    return { ...acc, [key]: (acc[key] ?? 0) + 1 }
  }, {})
