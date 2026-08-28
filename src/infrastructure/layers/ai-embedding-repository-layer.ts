/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dialect-gated `AiEmbeddingRepository` Layer — re-export.
 *
 * The Layer itself is defined beside the two implementations it selects
 * between, in
 * `infrastructure/database/repositories/ai/ai-embedding-repository-live.ts`.
 * That placement is deliberate: an application use-case may name a
 * `*-repository-live` Layer at a composition seam, but `infrastructure/layers/`
 * is not in `APPLICATION_INFRASTRUCTURE_ALLOWLIST`
 *, so a definition here would be unreachable
 * from the agent action handler that needs it.
 *
 * This module survives as the import path the infrastructure-side RAG pipeline
 * already uses. One definition, two paths to it.
 */

export { AiEmbeddingRepositoryActive } from '@/infrastructure/database/repositories/ai/ai-embedding-repository-live'
