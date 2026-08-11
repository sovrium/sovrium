/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure vector-math + BLOB-serialization helpers for the SQLite RAG repository
 *.
 *
 * SQLite has no pgvector equivalent, so embedding vectors are stored as raw
 * BLOBs (a `Float32Array` serialized to bytes) and cosine similarity is
 * computed in application code. These functions are pure and side-effect-free
 * so they can be unit-tested in isolation (Testing Trophy: infra pure functions
 * get co-located unit tests).
 *
 * The cosine-similarity contract mirrors the Postgres `1 - (embedding <=> q)`
 * pgvector operator: the returned score is in `[0, 1]` for the non-negative
 * embedding space the providers emit, so the same `minSimilarity` floor and
 * descending ranking hold identically across both dialects.
 */

/** Serialize an embedding vector into a `Float32Array`-backed byte buffer. */
export const serializeEmbedding = (embedding: ReadonlyArray<number>): Uint8Array =>
  new Uint8Array(Float32Array.from(embedding).buffer)

/**
 * Decode a stored embedding BLOB back into a plain number array. Accepts the
 * shapes `bun:sqlite` may surface a BLOB column as (`Uint8Array`, `Buffer`,
 * or `ArrayBuffer`); a `null`/unknown shape decodes to an empty vector so the
 * row is simply scored 0 and dropped, never crashing the search.
 */
export const deserializeEmbedding = (blob: unknown): ReadonlyArray<number> => {
  if (blob instanceof Float32Array) return Array.from(blob)
  if (blob instanceof ArrayBuffer) return Array.from(new Float32Array(blob))
  if (blob instanceof Uint8Array) {
    // Copy into a fresh, aligned buffer slice so the Float32Array view is valid
    // even when the underlying buffer has a non-zero byteOffset.
    return Array.from(
      new Float32Array(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength))
    )
  }
  return []
}

/**
 * Cosine similarity between two equal-length vectors, normalized to `[0, 1]`
 * for the non-negative embedding space. Returns 0 when either vector is empty,
 * has zero magnitude, or the lengths differ — a degenerate pair scores 0 and is
 * filtered out rather than ranked.
 */
export const cosineSimilarity = (a: ReadonlyArray<number>, b: ReadonlyArray<number>): number => {
  if (a.length === 0 || a.length !== b.length) return 0
  const { dot, magA, magB } = a.reduce(
    (acc, value, i) => ({
      dot: acc.dot + value * b[i]!,
      magA: acc.magA + value * value,
      magB: acc.magB + b[i]! * b[i]!,
    }),
    { dot: 0, magA: 0, magB: 0 }
  )
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
