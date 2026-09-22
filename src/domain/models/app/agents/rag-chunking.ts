/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RAG text-chunking — pure domain logic.
 *
 * Splits a piece of source text into fixed-size character windows with a
 * configurable overlap so semantically adjacent content stays co-located in
 * neighbouring chunks. The chunk size and overlap are operator-tunable via
 * the `AI_RAG_CHUNK_SIZE` / `AI_RAG_CHUNK_OVERLAP` env vars (the env layer
 * resolves the numbers; this module only performs the split).
 *
 * Pure: no I/O, no env reads — callers pass the resolved settings in.
 */

/** Default chunk size in characters when `AI_RAG_CHUNK_SIZE` is unset. */
export const DEFAULT_CHUNK_SIZE = 512

/** Default chunk overlap in characters when `AI_RAG_CHUNK_OVERLAP` is unset. */
export const DEFAULT_CHUNK_OVERLAP = 50

/** Resolved chunking settings. */
export interface ChunkSettings {
  readonly chunkSize: number
  readonly chunkOverlap: number
}

/**
 * Split `text` into overlapping character windows.
 *
 * - Text shorter than `chunkSize` yields a single chunk (the whole text).
 * - Empty / whitespace-only text yields no chunks.
 * - The window advances by `chunkSize - chunkOverlap` each step; an overlap
 *   greater than or equal to the size is clamped so the window always
 *   advances by at least one character (avoids an infinite loop).
 */
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

/** Parse a positive integer env value, falling back when unset or invalid. */
const parsePositiveIntEnv = (raw: string | undefined, fallback: number): number => {
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw.trim(), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Resolve chunking settings from a snapshot of env vars. Unset / invalid
 * values fall back to the eco-aligned defaults.
 */
export const resolveChunkSettings = (
  env: Readonly<Record<string, string | undefined>>
): ChunkSettings => ({
  chunkSize: parsePositiveIntEnv(env['AI_RAG_CHUNK_SIZE'], DEFAULT_CHUNK_SIZE),
  chunkOverlap: parsePositiveIntEnv(env['AI_RAG_CHUNK_OVERLAP'], DEFAULT_CHUNK_OVERLAP),
})
