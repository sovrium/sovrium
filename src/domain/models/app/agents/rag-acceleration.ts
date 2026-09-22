/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RAG acceleration configuration — pure domain logic (Phase 2, [internal ref]).
 *
 * Phase 1 (the shipped default) computes cosine similarity in application code
 * over Float32 BLOB vectors. Phase 2 adds an OPT-IN acceleration layer:
 *
 *  - `RAG_SQLITE_VEC`  — when `on`, RAG search uses a `sqlite-vec` ANN index
 *    (loaded as a native SQLite extension at runtime) instead of the app-side
 *    cosine scan. Frugal-by-default: OFF unless explicitly enabled.
 *  - `RAG_SQLITE_FTS5` — when `on`, an FTS5 BM25 lexical candidate set is
 *    unioned into the dense candidate set before the cosine rerank, recovering
 *    exact-term matches that pure dense cosine misses. Frugal-by-default: OFF.
 *
 * Both are OPERATOR env vars (never `app.*` schema fields), consistent with the
 * eco/infra-in-env contract. The acceleration layer is transparent: whichever
 * path serves a query keeps the identical response contract
 * (`agentName` / `sourceRef` / `content` / `similarity`).
 *
 * Pure + side-effect-free so it can be unit-tested in isolation (Testing
 * Trophy: domain logic gets co-located unit tests).
 */

/** Resolved RAG acceleration configuration. */
export interface RagAccelerationConfig {
  /** `RAG_SQLITE_VEC=on` — opt into the sqlite-vec ANN index. */
  readonly sqliteVec: boolean
  /** `RAG_SQLITE_FTS5=on` — opt into FTS5 BM25 lexical-hybrid candidates. */
  readonly fts5Hybrid: boolean
}

/**
 * Parse a single `on`/`off` operator toggle. Frugal-by-default: anything other
 * than a case-insensitive `on` / `true` / `1` resolves to OFF.
 */
const parseToggle = (raw: string | undefined): boolean => {
  if (raw === undefined) return false
  const normalized = raw.trim().toLowerCase()
  return normalized === 'on' || normalized === 'true' || normalized === '1'
}

/**
 * Resolve the RAG acceleration configuration from a snapshot of env vars.
 *
 * Frugal-by-default: every unset / unrecognised value resolves OFF, so the
 * shipped default is always the Phase 1 app-side cosine path.
 */
export const resolveRagAcceleration = (
  env: Readonly<Record<string, string | undefined>>
): RagAccelerationConfig => ({
  sqliteVec: parseToggle(env['RAG_SQLITE_VEC']),
  fts5Hybrid: parseToggle(env['RAG_SQLITE_FTS5']),
})
