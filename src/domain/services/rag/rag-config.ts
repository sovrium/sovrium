/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RAG runtime configuration — pure domain logic.
 *
 * Resolves the operator-tunable RAG knobs from a snapshot of env vars:
 *  - `AI_RAG_SIMILARITY`    — minimum cosine similarity for a search hit.
 *  - `AI_RAG_MAX_RESULTS`   — cap on similarity-search results.
 *  - `AI_RAG_CHUNK_SIZE`    — chunk window size (chars).
 *  - `AI_RAG_CHUNK_OVERLAP` — chunk window overlap (chars).
 *  - `AI_EMBEDDING_MODEL`   — embedding model (provider default when unset).
 *  - `AI_EMBEDDING_DIMENSIONS` — embedding vector width (auto-detected default).
 *
 * Frugal-by-default: every unset value resolves to a conservative default.
 */

import { resolveChunkSettings } from './rag-chunking'

/** Default minimum cosine similarity when `AI_RAG_SIMILARITY` is unset. */
export const DEFAULT_SIMILARITY = 0.5

/** Default similarity-search result cap when `AI_RAG_MAX_RESULTS` is unset. */
export const DEFAULT_MAX_RESULTS = 5

/**
 * Default embedding vector width. Matches the `vector(1536)` column declared
 * by migration 0000 (OpenAI ada-002 / text-embedding-3-small dimensionality).
 */
export const DEFAULT_DIMENSIONS = 1536

/** Resolved RAG configuration surfaced by `GET /api/ai/rag/config`. */
export interface RagConfig {
  readonly similarity: number
  readonly maxResults: number
  readonly chunkSize: number
  readonly chunkOverlap: number
  readonly embeddingModel: string
  readonly dimensions: number
}

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw.trim(), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const parseFloatInRange = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback
  const parsed = Number.parseFloat(raw.trim())
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
}

/**
 * Resolve the full RAG configuration from env vars. `embeddingModelFallback`
 * is the AI service's own provider-default embedding model — used when
 * `AI_EMBEDDING_MODEL` is unset.
 */
export const resolveRagConfig = (
  env: Readonly<Record<string, string | undefined>>,
  embeddingModelFallback: string
): RagConfig => {
  const chunk = resolveChunkSettings(env)
  const embeddingModel = env['AI_EMBEDDING_MODEL']?.trim() || embeddingModelFallback
  return {
    similarity: parseFloatInRange(env['AI_RAG_SIMILARITY'], DEFAULT_SIMILARITY),
    maxResults: parsePositiveInt(env['AI_RAG_MAX_RESULTS'], DEFAULT_MAX_RESULTS),
    chunkSize: chunk.chunkSize,
    chunkOverlap: chunk.chunkOverlap,
    embeddingModel,
    dimensions: parsePositiveInt(env['AI_EMBEDDING_DIMENSIONS'], DEFAULT_DIMENSIONS),
  }
}
