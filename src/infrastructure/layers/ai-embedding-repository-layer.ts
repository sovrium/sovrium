/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dialect-gated `AiEmbeddingRepository` Layer.
 *
 * Selects the embedding repository implementation from the active database
 * dialect — the same dispatch `db-bun.ts` uses to build the Drizzle client:
 *
 *   - `postgres` — `AiEmbeddingRepositoryLive` (pgvector `<=>` cosine search).
 *   - `sqlite`   — `AiEmbeddingRepositorySqlite` (Float32Array BLOBs + app-side
 *     cosine, the zero-config frugal default).
 *
 * Every RAG sync/search Effect program provides this gated Layer (via
 * `RagSyncLayer` in `embed-pipeline.ts`) instead of the Postgres-only `-live`
 * Layer, so the same code path runs on both runtimes.
 */

import { Layer } from 'effect'
import {
  AiEmbeddingRepositoryLive,
  AiEmbeddingRepositorySqlite,
} from '@/infrastructure/database/repositories/ai/ai-embedding-repository-live'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'

/**
 * The active-dialect AI embedding repository. Resolved per process via
 * `isSqliteRuntime()` (reads `DATABASE_URL` through `parseDatabaseDialectConfig`),
 * matching the dialect dispatch in `db-bun.ts`.
 */
export const AiEmbeddingRepositoryActive: Layer.Layer<AiEmbeddingRepository> = Layer.suspend(() =>
  isSqliteRuntime() ? AiEmbeddingRepositorySqlite : AiEmbeddingRepositoryLive
)
