/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Layer } from 'effect'
import {
  AiEmbeddingRepositoryLive,
  AiEmbeddingRepositorySqlite,
} from '@/infrastructure/database/repositories/ai/ai-embedding-repository-live'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'

export const AiEmbeddingRepositoryActive: Layer.Layer<AiEmbeddingRepository> = Layer.suspend(() =>
  isSqliteRuntime() ? AiEmbeddingRepositorySqlite : AiEmbeddingRepositoryLive
)
