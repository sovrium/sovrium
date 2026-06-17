/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface RagAccelerationConfig {
  readonly sqliteVec: boolean
  readonly fts5Hybrid: boolean
}

const parseToggle = (raw: string | undefined): boolean => {
  if (raw === undefined) return false
  const normalized = raw.trim().toLowerCase()
  return normalized === 'on' || normalized === 'true' || normalized === '1'
}

export const resolveRagAcceleration = (
  env: Readonly<Record<string, string | undefined>>
): RagAccelerationConfig => ({
  sqliteVec: parseToggle(env['RAG_SQLITE_VEC']),
  fts5Hybrid: parseToggle(env['RAG_SQLITE_FTS5']),
})
