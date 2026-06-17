/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class AiEmbeddingDatabaseError extends Data.TaggedError('AiEmbeddingDatabaseError')<{
  readonly cause: unknown
}> {}

export interface NewEmbedding {
  readonly agentName: string | null
  readonly sourceType: string
  readonly sourceId: string
  readonly sourceRef: string
  readonly chunkIndex: number
  readonly content: string
  readonly embedding: ReadonlyArray<number>
  readonly metadata?: Record<string, unknown>
}

export interface EmbeddingSearchResult {
  readonly agentName: string | null
  readonly sourceRef: string | null
  readonly content: string
  readonly similarity: number
}

export class AiEmbeddingRepository extends Context.Tag('AiEmbeddingRepository')<
  AiEmbeddingRepository,
  {
    readonly insertMany: (
      rows: ReadonlyArray<NewEmbedding>
    ) => Effect.Effect<void, AiEmbeddingDatabaseError>
    readonly search: (input: {
      readonly embedding: ReadonlyArray<number>
      readonly query?: string
      readonly agentName: string | undefined
      readonly minSimilarity: number
      readonly maxResults: number
    }) => Effect.Effect<ReadonlyArray<EmbeddingSearchResult>, AiEmbeddingDatabaseError>
    readonly deleteBySourceIdPrefix: (
      prefix: string
    ) => Effect.Effect<void, AiEmbeddingDatabaseError>
  }
>() {}
