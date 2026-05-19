/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { resolveChunkSettings } from './rag-chunking'

export const DEFAULT_SIMILARITY = 0.5

export const DEFAULT_MAX_RESULTS = 5

export const DEFAULT_DIMENSIONS = 1536

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
