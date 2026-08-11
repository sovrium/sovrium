/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { AiServiceLive } from './ai-service-live'

/**
 * AiLive — merged Layer exposing all AI infrastructure adapters.
 *
 * Mirrors `StorageLive` in `src/infrastructure/storage/layer.ts`. Currently
 * provides only `AiServiceLive`; a future `EmbeddingServiceLive` will be
 * merged here once its driver spec lands (see audit § P0 — Skip / out-of-
 * scope for v1: embedding service is deferred).
 */
export const AiLive = AiServiceLive
