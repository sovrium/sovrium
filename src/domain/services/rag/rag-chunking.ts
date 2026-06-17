/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const DEFAULT_CHUNK_SIZE = 512

export const DEFAULT_CHUNK_OVERLAP = 50

export interface ChunkSettings {
  readonly chunkSize: number
  readonly chunkOverlap: number
}

export const chunkText = (
  text: string,
  settings: ChunkSettings = {
    chunkSize: DEFAULT_CHUNK_SIZE,
    chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  }
): ReadonlyArray<string> => {
  const trimmed = text.trim()
  if (trimmed.length === 0) return []
  const size = Math.max(1, settings.chunkSize)
  if (trimmed.length <= size) return [trimmed]
  const stride = Math.max(1, size - Math.max(0, settings.chunkOverlap))
  const starts = Array.from(
    { length: Math.ceil((trimmed.length - size) / stride) + 1 },
    (_, i) => i * stride
  )
  return starts
    .map((start) => trimmed.slice(start, start + size))
    .filter((chunk) => chunk.trim().length > 0)
}

const parsePositiveIntEnv = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw.trim(), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export const resolveChunkSettings = (
  env: Readonly<Record<string, string | undefined>>
): ChunkSettings => ({
  chunkSize: parsePositiveIntEnv(env['AI_RAG_CHUNK_SIZE'], DEFAULT_CHUNK_SIZE),
  chunkOverlap: parsePositiveIntEnv(env['AI_RAG_CHUNK_OVERLAP'], DEFAULT_CHUNK_OVERLAP),
})
