/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const serializeEmbedding = (embedding: ReadonlyArray<number>): Uint8Array =>
  new Uint8Array(Float32Array.from(embedding).buffer)

export const deserializeEmbedding = (blob: unknown): ReadonlyArray<number> => {
  if (blob instanceof Float32Array) return Array.from(blob)
  if (blob instanceof ArrayBuffer) return Array.from(new Float32Array(blob))
  if (blob instanceof Uint8Array) {
    return Array.from(
      new Float32Array(blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength))
    )
  }
  return []
}

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
